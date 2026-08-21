-- 0028: LinkedIn on profiles.
--
-- The profile carried Instagram and a personal website but nothing professional,
-- which is the connection most members of a working diaspora actually want.
-- Stored as a full https URL (people paste the URL from their browser) rather
-- than a handle like instagram, because LinkedIn slugs vary (/in/, /pub/, and
-- localised hosts such as gr.linkedin.com).

alter table public.profiles
  add column if not exists linkedin text;

alter table public.profiles
  drop constraint if exists profiles_linkedin_url,
  add constraint profiles_linkedin_url check (
    linkedin is null
    or linkedin ~* '^https://([a-z0-9-]+\.)?linkedin\.com/.+'
  );

-- Additive column grant, per the 0012 lesson: table-level UPDATE stays revoked
-- and each self-editable column is granted explicitly. Granting one column does
-- not disturb the columns granted by 0012/0016.
grant update (linkedin) on public.profiles to authenticated;
