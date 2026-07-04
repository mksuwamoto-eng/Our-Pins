-- 0013: Parea Concierge — query log for spend caps and auditing.
--
-- Every Claude API call made by /api/concierge writes a row here. The route
-- refuses new queries once the current month's summed cost_usd reaches the
-- configured budget (CONCIERGE_MONTHLY_BUDGET_USD, default $10), and applies
-- a per-user daily query cap. RLS is enabled with NO policies on purpose:
-- only the service-role admin client touches this table.

create table public.concierge_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.concierge_queries enable row level security;

create index concierge_queries_created_at_idx
  on public.concierge_queries (created_at);
create index concierge_queries_user_day_idx
  on public.concierge_queries (user_id, created_at);
