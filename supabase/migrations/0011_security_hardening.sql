-- 0011: security hardening per audit findings.
--
-- 1. Revoke UPDATE on privileged profile columns from the `authenticated`
--    role so a signed-in user cannot escalate their own is_member / role
--    or backdate onboarded_at via a direct PATCH on /profiles. The admin
--    client (service_role) bypasses column grants so admin flows are
--    unaffected. The accept_invite and delete_user RPCs are security
--    definer and run as the function owner, so they can still flip these
--    columns.
--
-- 2. Recreate accept_invite() to reject calls where p_user differs from
--    auth.uid() — previously any signed-in user could pass another user's
--    id and flip is_member on that profile.
--
-- 3. Tighten owner-scoped RLS policies that did not check is_member.
--    Without this, a stale/revoked profile (is_member=false) could still
--    edit or delete their own pins / vouches / photos / private profile.
--    Admin paths continue to bypass via user_role = 'admin'.

-- ============================================================
-- 1. Column-level UPDATE revoke on profiles
-- ============================================================
revoke update (is_member, role, onboarded_at, archived_at)
  on public.profiles
  from authenticated;

-- ============================================================
-- 2. accept_invite — reject p_user / auth.uid() mismatch
-- ============================================================
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

  if inv.used_at is not null then
    if inv.used_by = p_user then
      return 'already_member';
    end if;
    return 'invalid';
  end if;

  if inv.expires_at < now() then
    return 'expired';
  end if;

  select * into prof from public.profiles where id = p_user;
  if not found then
    return 'invalid';
  end if;

  if prof.is_member then
    update public.invites set used_by = p_user, used_at = now() where token = p_token;
    return 'already_member';
  end if;

  update public.profiles
    set is_member = true,
        updated_at = now()
    where id = p_user;

  update public.invites
    set used_by = p_user,
        used_at = now()
    where token = p_token;

  return 'accepted';
end;
$$;

-- ============================================================
-- 3. Owner-scoped RLS policies — add is_member check
-- ============================================================

drop policy if exists pins_update_owner on public.pins;
create policy pins_update_owner on public.pins
  for update using (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  ) with check (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  );

drop policy if exists vouches_update on public.vouches;
create policy vouches_update on public.vouches
  for update using (
    auth.jwt() ->> 'is_member' = 'true' and voucher_id = auth.uid()
  ) with check (
    auth.jwt() ->> 'is_member' = 'true' and voucher_id = auth.uid()
  );

drop policy if exists vouches_delete on public.vouches;
create policy vouches_delete on public.vouches
  for delete using (
    auth.jwt() ->> 'user_role' = 'admin'
    or (auth.jwt() ->> 'is_member' = 'true' and voucher_id = auth.uid())
  );

drop policy if exists pin_photos_delete on public.pin_photos;
create policy pin_photos_delete on public.pin_photos
  for delete using (
    auth.jwt() ->> 'user_role' = 'admin'
    or (auth.jwt() ->> 'is_member' = 'true' and uploaded_by = auth.uid())
  );

drop policy if exists private_profiles_update on public.private_profiles;
create policy private_profiles_update on public.private_profiles
  for update using (
    auth.jwt() ->> 'user_role' = 'admin'
    or (auth.jwt() ->> 'is_member' = 'true' and id = auth.uid())
  ) with check (
    auth.jwt() ->> 'user_role' = 'admin'
    or (auth.jwt() ->> 'is_member' = 'true' and id = auth.uid())
  );
