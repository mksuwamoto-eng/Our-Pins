-- 0015: LINE bridge — let the Concierge log queries from LINE group members
-- who don't have an app account yet. user_id becomes nullable; line_user_id
-- carries the LINE userId so the per-user daily cap still applies to them.

alter table public.concierge_queries
  alter column user_id drop not null;

alter table public.concierge_queries
  add column line_user_id text;

-- Every query must still be attributable to someone.
alter table public.concierge_queries
  add constraint concierge_queries_actor_check
  check (user_id is not null or line_user_id is not null);

create index concierge_queries_line_user_day_idx
  on public.concierge_queries (line_user_id, created_at)
  where line_user_id is not null;
