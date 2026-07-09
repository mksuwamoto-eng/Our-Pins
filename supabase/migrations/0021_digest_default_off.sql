-- 0021: newly discovered LINE groups default to digest OFF.
--
-- Adding the bot to a group must never auto-post a digest — the admin enables
-- it deliberately from /admin/line-groups once ready. This makes joining a
-- group (even the big community group) a completely silent, side-effect-free
-- action on the digest side. Existing rows keep their current setting.
alter table public.line_groups alter column digest_enabled set default false;
