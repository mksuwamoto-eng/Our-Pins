-- Search uses pg_trgm only (see plan §Search — revised honesty).
-- pg_trgm is enabled in 0001; indexes for pins are created there.
-- This migration adds trigram indexes for profiles directory search.

create index profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops)
  where archived_at is null;
