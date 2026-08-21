-- 0029: make account deletion match the stated policy ("retained but anonymised").
--
-- The delete route runs the delete_user scrub RPC and then hard-deletes the
-- auth.users row. profiles.id carried ON DELETE CASCADE to auth.users, so the
-- anonymised profiles row was destroyed milliseconds after the scrub — and the
-- cascade fanned out through pins → vouches (including OTHER members' vouches
-- on the deleted member's pins), board_posts, resources, and feedback. The
-- settings copy promised anonymisation; the cascade delivered total deletion.
--
-- Fix: drop the FK so the anonymised profiles row survives the auth-row
-- delete. profiles rows are only ever created by our own sign-in callbacks
-- (admin client), and delete_user is the sole deletion path, so the FK was
-- doing no real integrity work. Found by name-agnostic lookup in case the
-- constraint name differs on the cloud DB.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

-- delete_user predates profiles.bio (0016) and profiles.linkedin (0028):
-- scrub those too, so "your private profile data will be erased" stays true.
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
        bio = null,
        linkedin = null,
        is_member = false,
        archived_at = now(),
        updated_at = now()
    where id = p_user;

  update public.pins set archived_at = now() where created_by = p_user and archived_at is null;
end;
$$;

revoke execute on function public.delete_user(uuid) from public;
grant execute on function public.delete_user(uuid) to authenticated;
