-- 0031: Close the private_profiles least-privilege gap.
--
-- Every other sensitive table uses the revoke-then-grant pattern (profiles
-- 0012, board_posts 0016, resources 0022, feedback 0024, line_groups 0020,
-- invite_uses 0027) so `authenticated` cannot write server-managed columns.
-- private_profiles was never touched, so it kept Supabase's default table-level
-- GRANT ALL to `authenticated`. RLS (0011 private_profiles_update) confines
-- writes to a member's own row, but within that row a member could
--   PATCH /rest/v1/private_profiles?id=eq.<own-uid>
-- and overwrite real_name / email / line_sub — columns only the service-role
-- (admin) client is meant to write (session.ts, onboarding/route.ts). This is
-- the exact gap 0025's comment flagged as a follow-up sweep TODO.
--
-- Members have NO legitimate direct write path to this table, so revoke all
-- write privileges. SELECT stays (RLS already limits it to admin-or-self);
-- the service-role client bypasses grants and continues to write these columns.

revoke insert, update, delete on public.private_profiles from authenticated;

-- Defense-in-depth: anon has no satisfiable RLS policy here, but drop its
-- default grants too (matches the 0025 hardening intent).
revoke all on public.private_profiles from anon;

-- Verify afterwards:
--   select privilege_type from information_schema.table_privileges
--   where table_name='private_profiles' and grantee='authenticated';
-- Should show only SELECT.
