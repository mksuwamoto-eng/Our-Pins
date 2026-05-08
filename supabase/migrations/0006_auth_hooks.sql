-- Custom Access Token Hook — injects is_member and role into the JWT
-- so RLS policies don't need a profiles subquery on every evaluation.
-- See plan §Custom JWT claims via Auth Hook.
--
-- After applying this migration, the hook must be enabled in the Supabase
-- dashboard: Authentication → Hooks → Custom Access Token. (Already configured
-- in supabase/config.toml for local development.)

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
  claims := jsonb_set(claims, '{role}', to_jsonb(coalesce(r, 'member')));
  claims := jsonb_set(claims, '{onboarded}', to_jsonb(onb is not null));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Allow the auth admin to invoke the hook
grant execute on function public.access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.profiles to supabase_auth_admin;
