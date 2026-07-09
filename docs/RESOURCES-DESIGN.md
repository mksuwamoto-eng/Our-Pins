# Resources / Shares — Converged Design (grill session 2026-07-09)

All 12 questions resolved. Every answer = option (A), the recommended path.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Primary mechanism | **Deliberate in-app posting.** No passive LINE group-chat capture — that's a privacy shift + all the misinterpretation/blame risk. If A exists, B is unnecessary. |
| Q2 | Data model | **New `resources` table + `/resources` page**, copying the board_posts pattern (0016): RLS with `is_member`/`user_role` claims, column-restricted grants, archive via `archived_at`. Board stays untouched. |
| Q3 | Post shape | **One shape: title + body + optional URL.** Body cap ~5000 chars (board is 2000) so real how-tos fit. URL normalized to https (reuse website-field logic). |
| Q4 | Categories | **Fixed CHECK-constraint set**: `how_to`, `watch`, `read`, `other`. Localized labels in messages/{en,el}.json. Filter chips on page. Change = migration, like board. |
| Q5 | Editing | **Creator + admin can edit** title/body/url/category (column grants + owner/admin UPDATE policies). Language bridge re-runs on edit. Card shows "updated <date>" when updated_at > created_at. Diverges from board deliberately: permanence demands editability; stable ids keep bot pointers valid. |
| Q6 | Interactions | **None in v1.** No endorsements, no comments — LINE group is the discussion layer, app is the record. "Worked for me" endorsement is the v2 candidate if staleness signal needed. |
| Q7 | Discovery | **Nav entry beside Board** (proposed label "Resources" / "Χρήσιμα" — final Greek label TBD by Mako), reverse-chron feed, category chips, client-side text search over title/body/translations. Nothing touches the map. |
| Q8 | Bot role | **Librarian: locate + point, never teach.** Resources join the concierge corpus (bounded section, board-posts pattern) so Parea can MATCH questions to posts, but prompt instructs pointer-only answers: title, author, date, deep-link via `[[res:id|title]]` marker → /resources anchor. Never restate how-to steps or summarize content. |
| Q9 | Digest | **In the weekly LINE digest from day one.** New "resources" section in buildWeeklyDigest; counts toward the content gate like board posts. |
| Q10 | LINE→app capture | **No bridge in v1.** Culture + digest loop; Mako nudges sharers. Revisit (1:1 share-to-Parea drafting) only if library visibly starves after ~a month. |
| Q11 | Title i18n | **Bridge title AND body** — translations jsonb holds {title, body} × {en, el}. Fixes the board title-gap for this surface (board itself stays as-is). |
| Q12 | Rollout | **Seed 5–10 real posts BEFORE announcing** (marriage-cert how-to, known docs/articles), one intro post in group, digest carries it after. Independent of big-group digest rollout — don't chain launches. |

## Implementation notes (from codebase exploration)

- Template: migration `0016_bio_and_board.sql` + `app/board/page.tsx` +
  `src/components/board/BoardClient.tsx` + `app/api/board/{route,[id]/route}.ts`.
- Next migration number: **0022**.
- RLS: apply the **0017 lesson** — SELECT policy must include
  `or created_by = auth.uid()` so owners can soft-archive (PostgREST RETURNING CTE).
- Column grants: **0012 lesson** — revoke table-level INSERT/UPDATE first, then
  grant insert(created_by, category, title, body, url) +
  update(title, body, url, category, archived_at). NOTE: update grant is wider
  than board's (edit feature) — no expires_at column exists to protect here.
- No expires_at column at all (permanent by design) — don't copy it from board.
- Language bridge: reuse the `after()` pattern; re-trigger on edit; include title.
- Concierge: new bounded corpus section in `src/lib/concierge/corpus.ts`
  (follow board-posts section, July 8 pattern); pointer-only instruction in the
  system prompt; `[[res:id|title]]` renderer alongside `[[pin:...]]`.
- Digest: extend `src/lib/digest/build.ts` (buildWeeklyDigest) + content gate.
- Admin moderation: board gap acknowledged — admin moderation feed covers pins
  only; archived resources reachable by admin via RLS. Same accepted gap as board v1.
- i18n: new `resources` namespace in messages/{en,el}.json; admin-facing bits
  English per convention.

## Open items NOT part of this build
- Greek nav label final call (Χρήσιμα vs alternative) — Mako decides at build time.
- v2 candidates: "worked for me" endorsement, 1:1 share-to-Parea draft capture,
  board-title translation backfill.
