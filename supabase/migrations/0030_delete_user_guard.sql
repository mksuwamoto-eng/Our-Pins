-- 0030: close the delete_user privilege hole (external security review,
-- Aug 22, 2026).
--
-- delete_user(p_user) is SECURITY DEFINER and granted to `authenticated`,
-- but — unlike accept_invite, which 0011 fixed — it never checked that
-- p_user is the caller. Any signed-in user could POST
-- /rest/v1/rpc/delete_user with another member's UUID (member UUIDs are
-- readable via profiles) and scrub their private profile, revoke their
-- membership, and archive their pins. 0029's rewrite re-shipped the gap.
--
-- Same guard pattern as accept_invite in 0011. The only caller
-- (app/api/account/delete/route.ts) uses the user's own session client with
-- p_user = user.id, so auth.uid() matches and the route is unaffected.
create or replace function public.delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only self-deletion. auth.uid() is null for non-request contexts, and
  -- IS DISTINCT FROM treats null as a mismatch, so those are rejected too.
  if p_user is distinct from auth.uid() then
    raise exception 'delete_user: caller may only delete their own account';
  end if;

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
