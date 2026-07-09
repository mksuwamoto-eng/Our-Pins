-- 0022: resources — permanent member-posted library (how-tos, things to
-- watch, things to read). Copies the board_posts pattern (0016) with the
-- deliberate divergences from the July 9, 2026 design:
--   * NO expires_at — resources are permanent by design.
--   * Optional url (https-only, like profiles.website).
--   * Body cap 5000 (board is 2000) so real how-tos fit.
--   * Creator + admin can EDIT (title/body/url/category), not just archive —
--     permanence demands editability; stable ids keep bot pointers valid.
--   * SELECT keeps rows visible to their creator (the 0017 lesson) so owners
--     can soft-archive despite PostgREST's RETURNING CTE.

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('how_to', 'watch', 'read', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  url text check (url is null or (url ~* '^https://' and char_length(url) <= 500)),
  translations jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resources_active_idx on public.resources (created_at desc)
  where archived_at is null;

create trigger resources_updated_at before update on public.resources
  for each row execute function public.tg_set_updated_at();

alter table public.resources enable row level security;

-- Claims: user_role (NOT the reserved 'role' — see 0008), is_member.
create policy resources_select on public.resources
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or created_by = auth.uid()
    or auth.jwt() ->> 'user_role' = 'admin'
  );

create policy resources_insert on public.resources
  for insert with check (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  );

create policy resources_update_owner on public.resources
  for update using (
    created_by = auth.uid() and auth.jwt() ->> 'is_member' = 'true'
  )
  with check (created_by = auth.uid());

create policy resources_update_admin on public.resources
  for update using (auth.jwt() ->> 'user_role' = 'admin');

create policy resources_delete_admin on public.resources
  for delete using (auth.jwt() ->> 'user_role' = 'admin');

-- Column grants (the 0012 lesson: revoke table-level first, then re-grant).
-- The UPDATE grant is deliberately wider than board's archived_at-only: the
-- edit feature needs the content columns, and there is no expires_at here to
-- protect. created_at/updated_at/translations/created_by stay out of reach
-- (updated_at is trigger-owned; translations are written by the language
-- bridge via the service role). Same accepted trade-off as 0017: an owner
-- could un-archive their own row via direct API.
revoke insert, update on public.resources from authenticated;
grant insert (created_by, category, title, body, url) on public.resources to authenticated;
grant update (title, body, url, category, archived_at) on public.resources to authenticated;
