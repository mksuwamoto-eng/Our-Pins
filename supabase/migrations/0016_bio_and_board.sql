-- 0016: profile bio + community noticeboard (board_posts)

-- ============================================================
-- profiles.bio — short free-text "about me", member-editable
-- ============================================================
alter table public.profiles
  add column bio text check (bio is null or char_length(bio) <= 500);

-- 0012 revoked table-level UPDATE and granted specific columns; column grants
-- are additive, so granting bio alone extends the editable set.
grant update (bio) on public.profiles to authenticated;

-- ============================================================
-- board_posts: community noticeboard (jobs, housing, for sale, events)
-- Trust model mirrors pins: any member posts, creator or admin archives.
-- ============================================================
create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('job', 'housing', 'for_sale', 'event', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  translations jsonb,
  expires_at timestamptz not null default (now() + interval '30 days'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index board_posts_active_idx on public.board_posts (created_at desc)
  where archived_at is null;

create trigger board_posts_updated_at before update on public.board_posts
  for each row execute function public.tg_set_updated_at();

alter table public.board_posts enable row level security;

-- Claims: user_role (NOT the reserved 'role' — see 0008), is_member.
create policy board_posts_select on public.board_posts
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or auth.jwt() ->> 'user_role' = 'admin'
  );

create policy board_posts_insert on public.board_posts
  for insert with check (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  );

create policy board_posts_update_owner on public.board_posts
  for update using (
    created_by = auth.uid() and auth.jwt() ->> 'is_member' = 'true'
  )
  with check (created_by = auth.uid());

create policy board_posts_update_admin on public.board_posts
  for update using (auth.jwt() ->> 'user_role' = 'admin');

create policy board_posts_delete_admin on public.board_posts
  for delete using (auth.jwt() ->> 'user_role' = 'admin');

-- Column grants (the 0012 lesson: revoke table-level first, then re-grant).
-- Without this, Supabase's default table-level grants would let a member set
-- expires_at/created_at on their own rows via PostgREST, pinning posts
-- forever and defeating the advertised 30-day expiry. The app only ever
-- inserts content columns and updates archived_at (archive/restore).
revoke insert, update on public.board_posts from authenticated;
grant insert (created_by, category, title, body) on public.board_posts to authenticated;
grant update (archived_at) on public.board_posts to authenticated;
