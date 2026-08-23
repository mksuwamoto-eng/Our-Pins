# Pin tags — design + build record

Status: **built and applied** (Aug 23, 2026). Migration `0034` is on the cloud
DB; the code is on the working tree, not yet committed or deployed.

## Problem

The 17 categories answer *what kind of place is this*. `greek-shops` answered a
different question — *why does this matter to a Greek in Japan* — so it was an
axis leak. That leak is why "Greek restaurant" had nowhere to live: the only
Greek-flavoured slot in the taxonomy was spent on shops. Adding
`restaurants-greek` would have spread the leak across every category and grown
the list combinatorially.

## Decision

A **tag layer**, orthogonal to category.

| | Category | Tag |
|---|---|---|
| Cardinality | exactly 1 per pin | 0–3 per pin |
| Question | what kind of place | why it's relevant to us |
| Storage | `categories` table + FK | `pins.tags text[]` + CHECK |
| Vocabulary | 17, frozen | 3, frozen |

A Greek taverna = Restaurants + `greek`. A Greek-speaking lawyer = Lawyers &
immigration + `greek-speaking`.

## Vocabulary

| slug | EN | EL |
|---|---|---|
| `greek` | Greek | Ελληνικό |
| `greek-speaking` | Greek spoken | Μιλάνε ελληνικά |
| `english-ok` | English OK | Αγγλικά OK |

Frozen like categories: no admin CRUD, a migration to change.

## Storage

No `tags` table. Three frozen slugs need no colour, icon, or sort order, and a
table would drag in RLS policies, grants, and a seed row each for nothing.

The vocabulary lives in **two places that must agree**: the `pins_tags_vocab`
CHECK (source of truth) and `TAG_SLUGS` in `src/lib/tags/index.ts`. That drift
is the one failure that silently breaks saving, so
`src/lib/tags/index.test.ts` **parses the migration file** and asserts the two
lists match — rather than restating the list in a third place.

### Migration `0034_pin_tags.sql` (applied Aug 23, 2026)

```sql
alter table public.pins add column tags text[] not null default '{}';

alter table public.pins add constraint pins_tags_vocab check (
  tags <@ array['greek', 'greek-speaking', 'english-ok']::text[]
  and cardinality(tags) <= 3
);

create index pins_tags_idx on public.pins using gin (tags)
  where archived_at is null;
```

`ADD COLUMN … DEFAULT` is metadata-only on PG 11+, so no table rewrite.

**An earlier draft carried an `UPDATE … where c.slug = 'greek-shops'` to
auto-tag that category. It was cut: `greek-shops` holds zero pins, active or
archived.** The category has never been used — worth knowing before deciding
what to do with it.

### Grants and RLS — nothing changed

`pins` has never had a grant or revoke in any migration, so it still carries
Supabase's default table-level `GRANT ALL` to `authenticated`, and that covers
new columns automatically. A member can therefore `PATCH tags` on their own row
via PostgREST — exactly as they already can for `name`, `vouch_note`, and
`category_id`, still confined to their own row by `pins_update_owner`.
**The CHECK, not the grant, is the bound that matters** (probes below).

Contrast `profiles`, where 0012 revoked the table-level UPDATE and re-granted
named columns: a new column there would *not* be writable without an additive
grant. `pins` needs none.

### `updated_at`

0025's trigger diffs the whole row minus `translations`/`updated_at`, so a
tags-only edit bumps `updated_at`. Nothing renders `pins.updated_at` — the
"edited" badge is Resources-only — so the backfill below was invisible to
members. No trigger change.

### Accepted nit

The CHECK bounds membership and cardinality but can't express uniqueness (a
CHECK may not contain a subquery). A direct PostgREST call could store
`{greek,greek}`, which would render two identical pills. The API route dedupes
(`.transform` in `pinCreateSchema`), so only a hand-rolled call reaches it —
cosmetic, and consistent with 0017's accepted trust-level trade-off.

## What was built

| File | Change |
|---|---|
| `src/lib/tags/index.ts` | `TAG_SLUGS`, `TagSlug`, `MAX_TAGS_PER_PIN`, `isTagSlug`, `TAG_CORPUS_LABELS` |
| `src/lib/tags/index.test.ts` | vocabulary sanity + **parses 0034 and asserts the CHECK matches** |
| `src/lib/schemas/pin.ts` | `tags` on `pinCreateSchema`: `z.enum(TAG_SLUGS)`, `.max(3)`, dedupe transform. `pinUpdateSchema` inherits it, and the PATCH route passes `parsed.data` through — no route change for edit |
| `src/lib/schemas/pin.test.ts` | 5 new cases: default, valid, unknown slug, dedupe, over-cardinality |
| `src/lib/supabase/types.ts` | `Pin.tags: string[]` |
| `app/api/pins/route.ts` | `tags` into the insert |
| `src/components/map/FacetFilter.tsx` | **new** — `CategoryFilter` generalized to one axis-agnostic dropdown |
| `src/components/map/CategoryFilter.tsx` | **deleted** — now a `FacetFilter` instance (refs in `HelpMenu`/`MobileNav` comments updated) |
| `src/components/map/FilterBar.tsx` | two `FacetFilter`s: categories, then tags |
| `src/components/map/MapView.tsx` | `tagCounts` memo, filter predicate, tag labels in the search haystack, deps |
| `src/components/pins/TagPicker.tsx` | **new** — one chip picker shared by all three pin forms |
| `PinForm` / `InlineAddPinForm` / `PinEditForm` | mount `TagPicker`, send `tags` |
| `src/components/map/PinSheet.tsx` | outlined tag pills beside the filled category badge |
| `src/lib/concierge/corpus.ts` | `Tags:` line per pin (≤3 short labels — bounded) |
| `messages/{en,el}.json` | `tags` namespace + `map.allTags`/`tagFilter`/`clearTags` + `pin.tagsLabel`/`tagsHint` |

### Filter semantics

OR within the tag facet; AND across facets (category ∧ tag ∧ member ∧ search).

Tag labels are also in MapView's search haystack, so typing "greek" finds the
tagged pins without opening the dropdown.

## Backfill (applied Aug 23, 2026)

Per Mako, three pins only — no category-derived rule, no sweep of the other 52:

| Pin | id | tags |
|---|---|---|
| Greek Taverna Milieu | `9b6babbd-fc3b-453e-a380-fb70be2b5365` | `{greek}` |
| OLYMPIA | `67a70aee-9554-422d-b67d-35d8a9303473` | `{greek}` |
| Sparta | `e0365399-ad7b-4e59-8fbd-4d91b652c1f6` | `{greek}` |

Verified after: 55 active pins, exactly 3 tagged, all others `{}`.
`greek-speaking` and `english-ok` launch at count 0 — they're for pins made from
here on, and the dropdown dims a zero row rather than hiding it.

## Verification

`pnpm typecheck`, `lint`, `test` (49 passing), and a strict `build` all pass.

Five minted-JWT probes as a **non-admin member** against production:

| Probe | Result |
|---|---|
| own pin, valid tag | 200, written — confirms the grant covers the new column |
| own pin, slug outside vocabulary | **23514** `pins_tags_vocab` |
| own pin, 4 tags | **23514** `pins_tags_vocab` |
| **another member's** pin | 0 rows — `pins_update_owner` holds |
| revert own pin to `{}` | 200, clean |

Still outstanding: the map itself is prod-gated (the Maps key is referrer-locked
to `our-pins.vercel.app`), so the dropdown, the picker, and the pills can only
be eyeballed after deploy.

## Non-goals

- **`greek-shops` stays for now.** It holds zero pins, so nothing was migrated
  off it. Retiring it is a separate decision.
- No admin CRUD for tags; no free-text tags; no tags on vouches, board posts,
  or resources.
