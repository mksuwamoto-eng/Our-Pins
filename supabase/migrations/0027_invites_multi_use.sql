-- 0027: multi-use invite links with an admin-chosen expiry.
--
-- Until now every invite was a single-use token (0001), and the only way to
-- invite N people was to mint N links (POST /api/admin/invites inserts one row
-- per `count`). That makes a group announcement impossible: there is no single
-- link you can post to a 200-person LINE group.
--
-- Adds a seat count (max_uses / use_count) plus an explicit revoked_at, so
-- "revoked" stops being inferred from an epoch expires_at — which made every
-- naturally-expired invite render as "Revoked" in the admin table.
--
-- Redemptions are recorded per user in invite_uses so a multi-use link can tell
-- a repeat click from a new member, and so admins can see who joined through
-- which link. On a multi-use invite, invites.used_by / used_at now mean "most
-- recent redeemer"; invite_uses is the full record.

-- ============================================================
-- 1. Seat count + explicit revocation
-- ============================================================
alter table public.invites
  add column if not exists max_uses int not null default 1,
  add column if not exists use_count int not null default 0,
  add column if not exists revoked_at timestamptz;

alter table public.invites
  drop constraint if exists invites_max_uses_range,
  add constraint invites_max_uses_range check (max_uses between 1 and 1000);

alter table public.invites
  drop constraint if exists invites_use_count_nonneg,
  add constraint invites_use_count_nonneg check (use_count >= 0);

-- Existing consumed invites: one seat, already taken.
update public.invites
  set use_count = 1
  where used_at is not null and use_count = 0;

-- Rows revoked under the old scheme (expires_at forced to the epoch by the
-- DELETE route) become explicitly revoked, so they stop being indistinguishable
-- from invites that simply ran out their 14 days.
update public.invites
  set revoked_at = created_at
  where used_at is null
    and revoked_at is null
    and expires_at <= to_timestamp(0);

-- ============================================================
-- 2. invite_uses — who redeemed a seat, on which link
-- ============================================================
create table if not exists public.invite_uses (
  token uuid not null references public.invites(token) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (token, user_id)
);

create index if not exists invite_uses_user_idx on public.invite_uses (user_id);

-- Backfill the single-use history so old links show their redeemer too.
insert into public.invite_uses (token, user_id, used_at)
  select token, used_by, coalesce(used_at, created_at)
    from public.invites
   where used_by is not null
on conflict do nothing;

alter table public.invite_uses enable row level security;

-- Admins read; writes happen only inside accept_invite (security definer, so it
-- bypasses RLS). Members never touch this table directly.
drop policy if exists invite_uses_admin_select on public.invite_uses;
create policy invite_uses_admin_select on public.invite_uses
  for select using (auth.jwt() ->> 'user_role' = 'admin');

grant select on public.invite_uses to authenticated;
revoke all on public.invite_uses from anon;

-- ============================================================
-- 3. accept_invite — seat-aware
-- ============================================================
-- Keeps every guarantee 0011 added (p_user must equal auth.uid()) and adds:
--   * revoked_at short-circuit
--   * seat exhaustion ('exhausted')
--   * per-user redemption record, so a repeat click is idempotent
-- The `for update` lock serialises concurrent redemptions of the same link, so
-- use_count can never overshoot max_uses.
create or replace function public.accept_invite(p_token uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  prof record;
begin
  if p_user is null or p_user <> auth.uid() then
    raise exception 'accept_invite: p_user must match auth.uid()';
  end if;

  select *
    into inv
    from public.invites
    where token = p_token
    for update;

  if not found then
    return 'invalid';
  end if;

  -- A repeat click on a link this user already redeemed is not an error.
  if exists (
    select 1 from public.invite_uses where token = p_token and user_id = p_user
  ) then
    return 'already_member';
  end if;

  if inv.revoked_at is not null then
    return 'invalid';
  end if;

  if inv.expires_at < now() then
    return 'expired';
  end if;

  if inv.use_count >= inv.max_uses then
    return 'exhausted';
  end if;

  select * into prof from public.profiles where id = p_user;
  if not found then
    return 'invalid';
  end if;

  -- Already a member: don't burn a seat, and don't record them as having
  -- joined through this link.
  if prof.is_member then
    return 'already_member';
  end if;

  update public.profiles
    set is_member = true,
        updated_at = now()
    where id = p_user;

  insert into public.invite_uses (token, user_id) values (p_token, p_user);

  update public.invites
    set use_count = use_count + 1,
        used_by = p_user,
        used_at = now()
    where token = p_token;

  return 'accepted';
end;
$$;
