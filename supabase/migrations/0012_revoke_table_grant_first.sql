-- 0012: Re-do the column restriction properly.
--
-- 0011 attempted `revoke update (col_list) on public.profiles from authenticated`
-- but the table already has a broader `grant update on public.profiles to
-- authenticated` from Supabase's default schema setup. In Postgres, a
-- table-level grant takes precedence over column-level revokes, so the
-- column revoke was a no-op.
--
-- The correct pattern: revoke the table-level UPDATE entirely, then grant
-- UPDATE only on the columns the user is allowed to change.

revoke update on public.profiles from authenticated;

grant update (display_name, avatar_path, display_pref, instagram, website)
  on public.profiles to authenticated;

-- Sanity check via the same query the user ran:
--   select column_name, privilege_type from information_schema.column_privileges
--   where table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE';
-- Should now show only the five user-editable columns.
