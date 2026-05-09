-- 0008: rename our custom JWT claim from `role` to `user_role`.
--
-- Supabase reserves the top-level JWT `role` claim for "which Postgres role
-- to use for this connection" (typically `authenticated`, `anon`,
-- `service_role`). The original 0006_auth_hooks overwrote that claim with
-- the user's app role ('member' / 'admin'), which caused PostgREST to
-- attempt SET ROLE admin and error out with `role "admin" does not exist`.
--
-- This migration:
--   1. Replaces access_token_hook to set `user_role` (and leave `role` alone)
--   2. Drops every RLS policy that referenced `auth.jwt() ->> 'role'`
--      and recreates it referencing `auth.jwt() ->> 'user_role'`
--   3. Same for the storage policies in 0004
--
-- After applying, every signed-in user must sign out and sign back in
-- to receive a JWT with the new claim shape.

-- ============================================================
-- 1. Replace the hook
-- ============================================================
create or replace function public.access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := event -> 'claims';
  uid uuid := (event ->> 'user_id')::uuid;
  is_m boolean;
  r text;
  onb timestamptz;
begin
  select is_member, role, onboarded_at
    into is_m, r, onb
    from public.profiles
    where id = uid;

  claims := jsonb_set(claims, '{is_member}', to_jsonb(coalesce(is_m, false)));
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(r, 'member')));
  claims := jsonb_set(claims, '{onboarded}', to_jsonb(onb is not null));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- ============================================================
-- 2. Recreate RLS policies on public schema tables
-- ============================================================

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or auth.jwt() ->> 'user_role' = 'admin'
    or id = auth.uid()
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (auth.jwt() ->> 'user_role' = 'admin');

-- private_profiles
drop policy if exists private_profiles_select on public.private_profiles;
create policy private_profiles_select on public.private_profiles
  for select using (
    auth.jwt() ->> 'user_role' = 'admin' or id = auth.uid()
  );

drop policy if exists private_profiles_update on public.private_profiles;
create policy private_profiles_update on public.private_profiles
  for update using (
    auth.jwt() ->> 'user_role' = 'admin' or id = auth.uid()
  );

-- categories
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'user_role' = 'admin'
  );

drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

-- pins
drop policy if exists pins_select on public.pins;
create policy pins_select on public.pins
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or auth.jwt() ->> 'user_role' = 'admin'
  );

drop policy if exists pins_update_admin on public.pins;
create policy pins_update_admin on public.pins
  for update using (auth.jwt() ->> 'user_role' = 'admin');

drop policy if exists pins_delete_admin on public.pins;
create policy pins_delete_admin on public.pins
  for delete using (auth.jwt() ->> 'user_role' = 'admin');

-- pin_photos
drop policy if exists pin_photos_select on public.pin_photos;
create policy pin_photos_select on public.pin_photos
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'user_role' = 'admin'
  );

drop policy if exists pin_photos_delete on public.pin_photos;
create policy pin_photos_delete on public.pin_photos
  for delete using (
    uploaded_by = auth.uid()
    or auth.jwt() ->> 'user_role' = 'admin'
  );

-- vouches
drop policy if exists vouches_select on public.vouches;
create policy vouches_select on public.vouches
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'user_role' = 'admin'
  );

drop policy if exists vouches_delete on public.vouches;
create policy vouches_delete on public.vouches
  for delete using (
    voucher_id = auth.uid() or auth.jwt() ->> 'user_role' = 'admin'
  );

-- invites
drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

-- ============================================================
-- 3. Recreate storage policies
-- ============================================================
drop policy if exists pin_photos_storage_select on storage.objects;
create policy pin_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'pin-photos'
    and (auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'user_role' = 'admin')
  );

drop policy if exists pin_photos_storage_delete on storage.objects;
create policy pin_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and (
      auth.jwt() ->> 'user_role' = 'admin'
      or (
        (storage.foldername(name))[1] = 'avatars'
        and split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
      )
      or exists (
        select 1 from public.pins p
        where p.id::text = (storage.foldername(name))[1]
          and p.created_by = auth.uid()
      )
    )
  );
