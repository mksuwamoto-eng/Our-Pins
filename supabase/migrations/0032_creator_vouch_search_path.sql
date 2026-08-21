-- 0032: Pin the search_path on tg_creator_vouch.
--
-- It is the only `security definer` object in the schema without an explicit
-- `set search_path` — access_token_hook (0006/0008), accept_invite
-- (0007/0011/0027) and delete_user (0007/0029/0030) all set it. Not
-- exploitable today (the body schema-qualifies public.vouches, and
-- `authenticated` has no CREATE on any schema in the default path), so this is
-- consistency + defence-in-depth, not a live hole.
--
-- Body is byte-for-byte 0003's; only the `set search_path` line is added.
-- The existing `pins_creator_vouch` trigger keeps pointing at this function,
-- so no trigger DDL is needed.

create or replace function public.tg_creator_vouch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vouches (pin_id, voucher_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end$$;

-- Verify afterwards:
--   select proname, proconfig from pg_proc
--   where pronamespace = 'public'::regnamespace and prosecdef;
-- Every row should list search_path=public.
