-- 0033: move the invariants that only existed in Next.js routes into the
-- database (external repository sweep, Aug 22, 2026).
--
-- Members hold a Supabase anon key + their own JWT, so anything enforced only
-- in an API route can be skipped by calling PostgREST directly. Most of those
-- gaps are accepted at this trust level (see 0017's note) — the four closed
-- here are the ones where a direct call breaks something the app treats as
-- true, not just a soft cap:
--
--   1. display_name uniqueness  — impersonation, in an app built on "who
--                                  vouched for this"
--   2. avatar_path ownership    — same, via another member's photo
--   3. creator's own vouch      — the route refuses to delete it; the DB did not
--   4. four photos per pin      — storage cost with no ceiling
--
-- Deliberately NOT closed (advisory limits, not security controls): the
-- board/resource daily+active posting caps in src/lib/limits.ts.
--
-- Verified against production before writing: 24 profiles, 0 case-insensitive
-- display-name collisions, 0 avatar_path values outside the two shapes below,
-- 65 pins all holding their creator vouch, no pin above 1 photo.

-- ============================================================
-- 1. display_name is unique, case-insensitively
-- ============================================================
-- The API route already lower()-compares on write; 0012 grants members direct
-- UPDATE on display_name, so nothing stopped a PATCH from taking a name that
-- was already someone's.
--
-- Partial on purpose. Two placeholder names are shared by construction and
-- must stay exempt:
--   'New member'  — pre-onboarding bootstrap (onboarded_at is null)
--   'Deleted user' — delete_user's scrub (0029/0030), which sets archived_at
create unique index profiles_display_name_ci_uniq
  on public.profiles (lower(display_name))
  where onboarded_at is not null and archived_at is null;

-- ============================================================
-- 2. avatar_path belongs to its own profile
-- ============================================================
-- Storage uploads go to avatars/<uid>/<file> and the storage policy (0010)
-- enforces that folder. The profiles column had no matching constraint, so a
-- member could point their row at another member's object.
alter table public.profiles
  add constraint profiles_avatar_path_own check (
    avatar_path is null
    or avatar_path in ('avatars/_pending.png', 'avatars/_deleted.png')
    or avatar_path like 'avatars/' || id::text || '/%'
  );

-- ============================================================
-- 3. the creator's vouch on their own pin cannot be deleted
-- ============================================================
-- tg_creator_vouch (0003) inserts it; app/api/pins/[id]/vouch DELETE returns
-- 403 for it; but vouches_delete (0011) let any voucher delete their own row,
-- creator included, leaving a pin nobody vouches for. Archiving the pin is the
-- supported way to withdraw.
--
-- Done in the policy rather than a BEFORE DELETE trigger on purpose: RLS is not
-- applied to referential-integrity cascades, so an admin hard-deleting a pin
-- (pins_delete_admin, 0008) still cascades its vouches away cleanly, and the
-- service-role client is unaffected. A trigger would have had to guess whether
-- it was firing inside a cascade.
--
-- The admin arm is unchanged: an admin can still delete any single vouch.
drop policy if exists vouches_delete on public.vouches;
create policy vouches_delete on public.vouches
  for delete using (
    auth.jwt() ->> 'user_role' = 'admin'
    or (
      auth.jwt() ->> 'is_member' = 'true'
      and voucher_id = auth.uid()
      and not exists (
        select 1 from public.pins p
        where p.id = vouches.pin_id and p.created_by = vouches.voucher_id
      )
    )
  );

-- ============================================================
-- 4. at most four photos per pin
-- ============================================================
-- app/api/pins/[id]/photos counts before inserting, but that is both a
-- check-then-act race and skippable via a direct PostgREST insert. The trigger
-- is the real ceiling; the route keeps its count so members get a clean 400
-- instead of a 500.
create or replace function public.tg_pin_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n from public.pin_photos where pin_id = new.pin_id;
  if n >= 4 then
    raise exception 'a pin can have at most 4 photos'
      using errcode = 'check_violation';
  end if;
  return new;
end$$;

create trigger pin_photos_limit
  before insert on public.pin_photos
  for each row execute function public.tg_pin_photo_limit();

-- ============================================================
-- 5. expired board posts are hidden by policy, not just by query
-- ============================================================
-- app/board/page.tsx filters expires_at > now(), but board_posts_select (last
-- rewritten in 0017) checked only archived_at, so any member could read expired
-- posts straight from PostgREST. The privacy copy says expired posts are hidden
-- from the app and merely retained — make the boundary match the promise.
-- Creator and admin keep full visibility, exactly as with archived rows.
drop policy if exists board_posts_select on public.board_posts;
create policy board_posts_select on public.board_posts
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null and expires_at > now())
    or created_by = auth.uid()
    or auth.jwt() ->> 'user_role' = 'admin'
  );
