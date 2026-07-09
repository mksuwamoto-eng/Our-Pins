-- 0024: in-app feedback (bug reports + feature ideas), July 9, 2026.
-- Members submit via the header feedback button; admins read at
-- /admin/feedback. Write-only for members by design: no UPDATE policy, no
-- UPDATE grant, and admin-only SELECT — the API inserts with
-- return=minimal, so the creator never needs SELECT on the new row (the
-- 0017 RETURNING lesson applies to returning representations, which we
-- simply don't do here).

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bug', 'feature')),
  body text not null check (char_length(body) between 1 and 2000),
  page_context text check (page_context is null or char_length(page_context) <= 300),
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Claims: user_role (NOT the reserved 'role' — see 0008), is_member.
create policy feedback_insert on public.feedback
  for insert with check (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  );

create policy feedback_select_admin on public.feedback
  for select using (auth.jwt() ->> 'user_role' = 'admin');

create policy feedback_delete_admin on public.feedback
  for delete using (auth.jwt() ->> 'user_role' = 'admin');

-- Column grants (the 0012 lesson: revoke table-level first, then re-grant).
-- Insert is content-columns only; created_at stays server-defaulted and no
-- UPDATE grant exists at all — feedback is immutable once sent.
revoke insert, update on public.feedback from authenticated;
grant insert (created_by, kind, body, page_context) on public.feedback to authenticated;
