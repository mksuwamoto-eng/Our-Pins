-- 0018: enforce one active pin per Google place.
--
-- pins.google_place_id had no unique constraint, so the same place could be
-- pinned twice (found July 8, 2026: two "Truffle Bakery Hiroo" rows). Two
-- consequences that this index closes:
--   * POST /api/pins has a 23505 branch that could never fire (dead until now).
--   * GET /api/pins/by-place used .maybeSingle(), which 500s on >1 row.
--
-- Partial + WHERE archived_at is null: only ACTIVE pins are constrained, so an
-- archived duplicate (or a re-pin of a place whose old pin was archived) stays
-- allowed. NULL google_place_id rows (manually added, non-Google pins) are
-- exempt.
--
-- Verified before applying: no active duplicates exist in prod. If that ever
-- changes, archive the extras first — CREATE UNIQUE INDEX fails on collision.

create unique index if not exists pins_place_active_uniq
  on public.pins (google_place_id)
  where google_place_id is not null and archived_at is null;
