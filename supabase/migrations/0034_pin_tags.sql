-- 0034: pin tags — a second, orthogonal axis to category (Aug 23, 2026).
--
-- The 17 categories answer "what kind of place is this". `greek-shops` answered
-- a different question — "why does this matter to a Greek in Japan" — which is
-- why "Greek restaurant" had nowhere to live. Tags carry that second axis so it
-- stops leaking into the category list (which would otherwise grow
-- combinatorially: restaurants-greek, cafes-greek, bakeries-greek, ...).
--
-- Storage is a text[] on pins, NOT a `tags` table + join table. Three frozen
-- slugs need no colour, icon, or sort order, and a table would drag in RLS
-- policies, grants, and a seed row each for nothing. At 55 active pins there is
-- nothing to normalise.
--
-- !! The vocabulary lives in TWO places that must agree: the CHECK below
-- !! (source of truth) and TAG_SLUGS in src/lib/tags/index.ts. Changing one
-- !! without the other means the UI offers a tag the DB rejects with 23514,
-- !! or hides one that exists. Change them in the same commit.
--
-- Grants: `pins` has never had a grant or revoke in any migration, so it still
-- carries Supabase's default table-level GRANT ALL to authenticated. A member
-- can therefore PATCH `tags` on their own row via PostgREST directly — exactly
-- as they already can for `name`, `vouch_note`, and `category_id`, and still
-- confined to their own row by pins_update_owner (which requires is_member).
-- The CHECK, not the grant, is the bound that matters: a direct call cannot
-- invent a tag outside the vocabulary. Consistent with 0017's accepted
-- trust-level trade-off; no new surface, so nothing to revoke here.
--
-- updated_at: 0025's trigger diffs the whole row minus translations/updated_at,
-- so a tags-only edit bumps updated_at and lights the "edited" badge. That is
-- correct — a tag change is a real content edit. No trigger change needed.
--
-- Verified against production before writing: `pins.tags` did not exist
-- (42703); `greek-shops` holds 0 pins, active or archived, so there is no
-- category-derived backfill to do here (an earlier draft of this migration had
-- an UPDATE for it — it would have matched nothing). Backfill is a handful of
-- rows applied out-of-band.

alter table public.pins
  add column tags text[] not null default '{}';

alter table public.pins
  add constraint pins_tags_vocab check (
    tags <@ array['greek', 'greek-speaking', 'english-ok']::text[]
    and cardinality(tags) <= 3
  );

-- Partial, matching every other pins index: archived rows are never filtered on.
create index pins_tags_idx on public.pins using gin (tags)
  where archived_at is null;
