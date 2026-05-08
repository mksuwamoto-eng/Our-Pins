-- Server-side RPCs invoked from API route handlers.

-- ============================================================
-- accept_invite(token uuid, user_id uuid) → 'accepted' | 'invalid' | 'expired' | 'already_member'
-- Validates an invite token, marks it used, and flips is_member on the profile.
-- Atomic. Idempotent for already-member users. Runs as security definer so
-- non-admins can call it (the only path where invites are touched without admin role).
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
  -- Lock the invite row to prevent double-use under concurrent calls.
  select *
    into inv
    from public.invites
    where token = p_token
    for update;

  if not found then
    return 'invalid';
  end if;

  if inv.used_at is not null then
    -- If THIS user used it, treat as success (idempotent on retry).
    if inv.used_by = p_user then
      return 'already_member';
    end if;
    return 'invalid';
  end if;

  if inv.expires_at < now() then
    return 'expired';
  end if;

  -- Ensure profile row exists (created at sign-in time, but be defensive).
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

revoke execute on function public.accept_invite(uuid, uuid) from public;
grant execute on function public.accept_invite(uuid, uuid) to authenticated;

-- ============================================================
-- delete_user(p_user uuid) → void
-- Right-to-erasure: scrubs PII, anonymises display_name, deletes private_profiles,
-- soft-archives content, then deletes the auth row via the calling service-role.
-- ============================================================
create or replace function public.delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The auth.users row deletion happens in the API route via the admin client
  -- after this RPC returns, since deleting auth.users from a SECURITY DEFINER
  -- function would require granting more privileges than we want.

  delete from public.private_profiles where id = p_user;

  update public.profiles
    set display_name = 'Deleted user',
        avatar_path = 'avatars/_deleted.png',
        instagram = null,
        website = null,
        is_member = false,
        archived_at = now(),
        updated_at = now()
    where id = p_user;

  update public.pins set archived_at = now() where created_by = p_user and archived_at is null;
end;
$$;

revoke execute on function public.delete_user(uuid) from public;
grant execute on function public.delete_user(uuid) to authenticated;
