-- 0020: LINE groups registry (weekly-digest targets) + digest run log.
--
-- The bot discovers every group it is added to (join event, or first message
-- seen in an already-joined group). The weekly digest pushes to each group
-- with digest_enabled = true and left_at is null. Groups are INDEPENDENT: the
-- same digest is pushed to each separately, nothing is synced between them, and
-- one group failing does not affect the others.
--
-- This is separate from LINE_GROUP_ID (passive in-group @parea Q&A), which
-- stays OFF: being a digest target does not enable group question-answering.

-- ============================================================
-- line_groups: one row per LINE group the bot has been in.
-- Written ONLY by the webhook + admin API via the service-role admin client
-- (which bypasses RLS), so there is no member write path. Admin-only read —
-- raw LINE group IDs are not member-facing.
-- ============================================================
create table public.line_groups (
  group_id text primary key,
  label text check (label is null or char_length(label) <= 80),
  digest_enabled boolean not null default true,
  added_at timestamptz not null default now(),
  left_at timestamptz
);

alter table public.line_groups enable row level security;

-- Admins read the registry to label groups + toggle the digest per group.
-- Members never see raw group IDs. All writes go through the service role.
create policy line_groups_select_admin on public.line_groups
  for select using (auth.jwt() ->> 'user_role' = 'admin');

-- Defense in depth (the 0012 lesson): strip default member write grants so a
-- member can never insert/update/delete rows even if a policy is added later.
revoke insert, update, delete on public.line_groups from authenticated;

-- ============================================================
-- digest_runs: idempotency + audit for the weekly digest. One row per
-- (week_start, group_id) actually posted, so a cron retry can't double-post
-- and can resend only to groups that previously failed. Service-role only
-- (RLS on, no policies — same pattern as concierge_queries in 0013).
-- ============================================================
create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  group_id text not null,
  item_count integer not null default 0,
  posted_at timestamptz not null default now(),
  unique (week_start, group_id)
);

alter table public.digest_runs enable row level security;
