# Our Pins — Project Context for New Sessions

Cross-session memory for the Our Pins project. New chats should read
this file first before doing anything.

---

## TL;DR

Private, invite-only community map for ~150 Greeks living in Japan.
Tap any place on a Google map → see vouches from the community or be
the first to vouch. Mako (the user) is the lead admin.

- **Repo**: `mksuwamoto-eng/Our-Pins` (capital O, capital P)
- **Production**: https://our-pins.vercel.app (Vercel; no custom
  domain planned — decided against `ourpins.app`, July 6, 2026)
- **Default branch**: `main`
- **Branch flow (as of July 9, 2026)**: commit straight to `main` and
  push; Vercel deploys from `main`. (Older sessions used a
  `claude/deploy-vercel-Lh8VI` feature branch kept ahead of main — no
  longer the workflow.)

---

## Stack snapshot

- Next.js 15.5.18 (App Router, RSC), React 19, TypeScript strict
- `next.config.ts` build checks re-enabled July 8, 2026
  (`ignoreBuildErrors`/`ignoreDuringBuilds` both false; the old
  deploy-day flags were stale — typecheck, lint, and strict build all
  passed with zero fixes when flipped).
- Tailwind 4 (beta) with custom theme; new `--surface-subtle` variable
  for dark-mode-aware card backgrounds (washi-100 light / indigo-700
  dark)
- Supabase: Auth, Postgres (project ref in `.env.local`, not committed),
  Storage, Realtime
- `@supabase/ssr` for the SSR cookie dance, no ORM by design
- Google Maps JS API + Places API (New) v1
- Zustand (filters), TanStack Query (server cache), next-intl (EL/EN),
  next-themes (dark mode), Vaul (bottom sheets)
- pnpm 9 on Vercel, pnpm 11 locally; lockfile committed

---

## Infra accounts

- **Supabase**: project ref in `.env.local` (not committed), Northeast Asia
  (Tokyo), Postgres 17. Custom Access Token JWT hook points at
  `public.access_token_hook` and sets `is_member`, `user_role`,
  `onboarded` claims.
- **Google Cloud**: project `our-pins`. APIs enabled: Maps JS, Places
  API New, Geocoding. Maps API key restricted to HTTP referrers
  `https://our-pins.vercel.app/*` and `https://ourpins.app/*`. OAuth
  consent screen in **Testing** mode (100-user cap, individual emails
  in Test Users allowlist).
- **Vercel**: deployed from `main`. Env vars set in dashboard (all 11
  from `.env.example`, with `NEXT_PUBLIC_SITE_URL=https://our-pins.vercel.app`).
- **LINE Developers**: LINE Login channel set up and working (Login +
  1:1 Concierge bot both live). Messaging API channel created under
  the same provider for the Parea bot; group-chat mode not yet
  enabled (bot not added to the group — see "LINE bot 'Parea'" below).

Local credentials live in `~/code/our-pins/.env.local` on Mako's Mac.
**Never commit that file.**

---

## What works in production (verified end-to-end with a real test user)

- ✅ **Public sign-in is LINE-only** (commit `3fe8d49`, July 9, 2026):
  the `/sign-in` page shows only "Sign in with LINE". The app is
  announced only in the community's LINE group, so anyone who sees the
  announcement already has LINE. Google OAuth + magic link still work as
  mechanisms but were moved to an unlinked `/admin-login` page (added to
  `middleware.ts` `PUBLIC_PREFIXES`) for Mako's own admin login —
  reachable only if you know the URL, not referenced from any nav.
- ✅ Sign-in via **magic link** (Supabase `signInWithOtp`, custom
  callback at `/api/auth/magic/callback`). Email sender is Supabase's
  default (rate-limited ~3/hr, often lands in spam). Now surfaced only
  on `/admin-login`, not the public sign-in page.
- ✅ Sign-in via **Google OAuth** (alt-email is the only whitelisted
  test user other than Mako himself). Also surfaced only on
  `/admin-login` now.
- ✅ Invite flow: admin mints invite at `/admin/invites` → "Copy link"
  → friend opens link → cookie set → sign-in page → LINE (the only
  public method) → callback consumes invite (flips `is_member=true`) →
  onboarding.
- ✅ Onboarding form: profile photo (optional), display name (required,
  case-insensitively unique), full name (optional, admin-only),
  Instagram + website (both optional, auto-prepends `https://`),
  community-guidelines checkbox.
- ✅ Click any Google POI on the map → bottom sheet with rich Google
  data + community vouches. "Be the first to vouch" inline form when
  no community pin exists.
- ✅ Pin marker click → same sheet → vouch / un-vouch / comment.
- ✅ Pin edit (category + vouch_note) and soft-delete (archive) for
  creator OR admin. (NOTE: creator-archive was silently broken for
  non-admins from launch until migration 0017 — it had only ever been
  verified as admin.)
- ✅ Admin tabs: members (promote/demote/revoke), invites (mint with
  note + count, copy link, revoke; revoked invites show "Revoked"
  state), moderation (archive/restore feed).
- ✅ `/settings/profile` — edit display name, photo, Instagram, website
  after onboarding.
- ✅ Avatars render on `/members` grid, `/members/[id]` profile, and
  inside PinSheet next to each voucher. Clicking an avatar/name links
  to the member's profile page.
- ✅ EL/EN i18n via cookie locale, dark mode toggle.
- ✅ GOJ logo wired into header, sign-in page, and PWA manifest
  (requires `public/icons/goj-logo.png` to exist — if Mako forgot to
  copy it, you'll see broken image icons).
- ✅ Sign-in via **LINE Login** (verified by Mako July 5, 2026: invite
  link → LINE sign-in → onboarding). Email permission from LINE still
  pending approval — until granted, LINE returns no email and new LINE
  users get synthetic emails (`line.<sub>@line.our-pins.local`), so
  existing Google/magic accounts don't auto-link.
- ✅ **Parea Concierge** — chat FAB (bottom-left of the map) →
  `/api/concierge` answers questions from the community's pins/vouches,
  member bios, and active noticeboard posts (corpus sections added
  July 8, 2026 — all bounded, so cost stays flat), citing members by name;
  `[[pin:id|name]]` markers render as deep-links. Full-corpus prompt
  (no vector store — deliberate at this scale) with prompt caching.
  Spend caps: `concierge_queries` log table, default $10/month
  (`CONCIERGE_MONTHLY_BUDGET_USD`) + 20 queries/user/day. The log stores
  question, asker id, tokens, cost, AND the model's answer text (answer
  added by migration 0026, July 9, 2026; disclosed in the privacy policy).
  Migrations 0013/0014 applied; `ANTHROPIC_API_KEY` set (per Mako, July 5, 2026).
- ✅ **Language bridge** — pin notes + vouch comments auto-translated
  EL↔EN on write (via `next/server after()`), stored in
  `translations jsonb`; PinSheet shows the reader's language with a
  "translated" toggle. No backfill of old rows yet.
- **Community features batch (July 7, 2026; needs migration 0016)**:
  - **Person filter** — member dropdown in the map FilterBar (only
    members with ≥1 pin); wired the pre-existing-but-unused
    `authorIds` in `src/stores/filters.ts`. Member profile pages link
    to `/?author=<id>` ("See them on the map"); MapView absorbs the
    param into the store and cleans the URL.
  - **Profile bio** — `profiles.bio` (≤500 chars), editable at
    `/settings/profile` (0016 extends the 0012 column-grant set),
    shown on `/members/[id]` along with pins/vouches counts and a
    clickable pin list. Not part of onboarding (deliberate).
  - **Noticeboard** — `/board` ("Board"/"Ανακοινώσεις" in nav):
    `board_posts` table, categories job/housing/for_sale/event/other,
    posts auto-expire 30 days after posting (filtered in the page
    query; rows stay in the DB), body goes through the language
    bridge. Trust model mirrors pins: any member posts, creator or
    admin soft-archives ("Remove"); no approval queue. Column grants
    lock direct PostgREST writes to insert(content cols) +
    update(archived_at) only. Known v1 gaps (accepted): titles not
    translated; expired/archived posts invisible to everyone in-app
    (admin moderation feed covers pins only); no edit-after-post.

---

## LINE bot "Parea" — 1:1 live, weekly digest live, passive group Q&A off (updated July 9, 2026)

> **July 9, 2026 — weekly digest shipped.** The bot now joins LINE groups to
> post a **weekly digest** (Sun 19:00 JST via Vercel cron `0 10 * * 0` →
> `app/api/cron/digest/route.ts` → `src/lib/digest/build.ts`
> `buildWeeklyDigest`). It's **deterministic** (no LLM), bilingual, lists the
> week's new pins / noticeboard posts / new members with app deep-links, and is
> **content-gated** (skip unless ≥1 new board post OR ≥2 total new items — quiet
> weeks stay silent). Pushes to each enabled group independently
> (`pushLineMessage` in `src/lib/line/messaging.ts`), idempotent per
> `(week_start, group_id)` via `digest_runs`. Groups **auto-register** (join
> event, or backfilled from first message, cache-guarded) in `line_groups`;
> managed at **`/admin/line-groups`** (label + per-group digest toggle). Join is
> **silent** (no auto-message) and digest **defaults OFF** per group (0020/0021),
> so adding the bot to a group has ZERO visible effect until an admin toggles it
> on. Cron route self-authenticates (`CRON_SECRET` env, or Vercel's
> `x-vercel-cron` header) and is allow-listed in `middleware.ts`. A localhost
> dry-run (`GET /api/cron/digest?dry=1`, dev-only) previews the text against prod
> data without posting. Verified on a test group (Mako ran a manual send).
> Passive `@parea` group **Q&A stays OFF** (still gated on `LINE_GROUP_ID`) —
> being a digest target does not enable question-answering. Group-chat capture /
> "ask the bot what was posted in the group" is a SEPARATE, not-yet-designed idea
> (being grilled) — do not assume it exists.

The Concierge is reachable from LINE — the "LINE bridge" from the
vision deck (Horizon 2). `app/api/line/webhook/route.ts` receives
LINE Messaging API webhooks (signature-verified, ACKs immediately,
answers in `after()` via reply tokens — free, 1-min TTL). **1:1 chat
confirmed working by Mako (July 6, 2026)** — Messaging API channel
created under the same provider as LINE Login, `LINE_MESSAGING_CHANNEL_SECRET`
/ `LINE_MESSAGING_ACCESS_TOKEN` set in `.env.local` + Vercel, migration
0015 applied to cloud. Group chat is deliberately on hold, not blocked:

- **Group chat**: answers only in the group whose id matches
  `LINE_GROUP_ID`, and only when @mentioned or the text starts with
  a literal `@parea`/`@παρέα`. Bare "παρέα …" does NOT trigger (it's
  an everyday Greek word). Group membership = trust boundary, so
  members without app accounts may ask; they're rate-capped by LINE
  userId (`concierge_queries.line_user_id`, migration 0015).
- **1:1 chat**: active members only — LINE userId must map to
  `private_profiles.line_sub` AND `profiles.is_member=true` (a
  line_sub row alone is not membership: the login callback writes it
  before invite consumption). Others get a "sign in first" reply.
- Shared core: `src/lib/concierge/ask.ts` (`askParea`) — extracted
  from the web route; both channels share the $10/month budget and
  20/day caps, which now **fail closed** on guard-query errors.
- Vouch-drafting from shared locations: deliberately NOT in v1
  (replies "can't do that yet").

**DECISION (July 9, 2026): passive/mention-gated group Q&A stays
PERMANENTLY off.** The bot is in the main LINE group ONLY to post the
weekly digest; `LINE_GROUP_ID` stays unset so in-group question-answering
never fires. Settled stance, not a "for now." Rationale: even
mention-gated (`@parea` only), a general-purpose group used for other
things could feel like noise if several restaurant questions land
back-to-back. Members who want Parea reach it 1:1 instead (publicize the
bot's LINE account). Rejected alternatives (do not re-propose without new
info): a second bot-only group (onboarding friction — nobody re-adds new
members); per-user push of answers/digest (LINE free plan caps push at
200/month total — a weekly per-member push would blow the quota in week
one; group broadcast is ~4–5 pushes/month regardless of size).

Remaining work (transparency, not code): post a one-time message in the
LINE group explaining the bot only posts a weekly recap of already-public
in-app data — it doesn't read/store/use other group messages and can't see
the roster beyond people who message it directly — and mirror it as a
permanent `/resources` post so it's durably checkable, not just scrollback.

If group Q&A were ever reversed (not planned): add the bot to the group,
copy the groupId from the `[line/webhook] joined group:` Vercel log line
into `LINE_GROUP_ID` (both envs), redeploy, and @mention to test.

---

## Resources library + feedback button (built July 9, 2026; verified in dev, pending merge)

Per the converged design in `docs/RESOURCES-DESIGN.md` (all 12 decisions
locked — do not re-litigate):

- **Resources** — permanent member-posted library (how-tos / watch / read /
  other) at `/resources`, nav label EN "Resources" / EL **"Χρήσιμα"**.
  `resources` table (0022, board_posts pattern minus `expires_at`; body ≤5000;
  optional https-only `url` ≤500 — Zod checks length AFTER the https prepend);
  creator+admin can EDIT (title/body/url/category via column grants — a
  deliberate divergence from board), archive as usual. Language bridge covers
  **title AND body** (`translations jsonb = {title:{el,en}, body:{el,en}}`,
  `translateResource` in translate.ts — always writes, even null, so a failed
  re-translation clears stale text; body call passes `maxTokens 16000` because
  the 6000 default truncates 5000-char bodies mid-JSON). Client-side search
  matches originals AND translations. Card shows "edited <when>" only for real
  content edits (0023/0025 trigger WHEN clauses — the bridge's translations
  write must not bump `updated_at`). Deep-links are `/resources?res=<id>`
  (query param, NOT `#fragment` — fragments don't survive the sign-in
  redirect; ResourcesClient absorbs the param, scrolls, flashes a ring, cleans
  the URL, same pattern as `?pin=`/`?author=`). Concierge: bounded RESOURCES
  corpus section (both title languages + 400-char code-point-safe excerpt) +
  **librarian rules** — point via `[[res:id|title]]` markers, never restate
  steps or enumerate the post's contents. Marker grammar (markers.ts) uses a
  lazy label + `(?!\])` so titles with brackets — even trailing `]` — render.
  LINE webhook resolves both marker kinds through one parameterized
  `markersToLinks` helper (DB-title-over-marker-text injection defense).
  Weekly digest gained a `📚 Χρήσιμα / Resources` section; any new resource
  alone passes the content gate (like board posts). Rollout per design Q12:
  Mako seeds 5–10 real posts BEFORE announcing; nothing is announced
  automatically.
- **Feedback button** — header icon (next to language/theme toggles) → Vaul
  sheet, bug/feature chips + textarea, EL/EN. `feedback` table (0024):
  member INSERT only (column grants, `return=minimal` so no creator SELECT
  needed), admin-only SELECT/DELETE, **no UPDATE grant at all** (immutable).
  `page_context` is allowlisted server-side to app-pathname shape (it renders
  as trusted metadata for admins). Admin triage at `/admin/feedback`
  (nav label localized: EL "Σχόλια"), query capped `.limit(200)`.
- **Deferred refactors** (flagged by the July 9 code review, all pre-existing
  debt the new pages extended): the ~25-line author/avatar signed-URL block
  is copied across ~5 pages (board, members, activity, members/[id],
  resources); `UUID_RE` has 7 copies across API routes; chip button classes
  ~6 copies. Extract-to-helper candidates for a dedicated session.
- **Known pre-existing issue observed during verification**: Parea answers in
  Greek to English questions (4/4 probes incl. a plain place question — NOT
  caused by the resources prompt edits). The LANGUAGE rule in ask.ts's
  SYSTEM_INSTRUCTIONS is being ignored under `effort: low`; candidate fix is
  repeating/moving the rule at the end of the prompt. Not shipped — Mako's
  call.

**Verification pattern used (reusable):** forge an @supabase/ssr session
cookie (`sb-<ref>-auth-token=base64-<b64url(session JSON)>` with a minted
HS256 JWT) to drive local-dev API routes and the browser preview as any
member; probe RLS/grants directly via PostgREST. Scripts in the session
scratchpad (verify-0022/phase2/phase4/0023-0024). **Gotcha:** never run
`pnpm build` while `pnpm dev` is running — they share `.next` and the dev
server serves corrupted chunks afterward (pages render but React never
hydrates, no console errors; fix: stop dev, `rm -rf .next`, restart).

---

## UX + governance batch (built July 11, 2026; typecheck/lint/build pass, pending prod verification)

Batch from Mako's feedback. **No new DB migrations** (`pin_photos`
already existed from 0001). All member-facing strings localized EL/EN;
admin panels stay English.

- **Category filter dropdown** — replaced the all-17-chips row in
  `src/components/map/FilterBar.tsx` with a multi-select popover
  (`src/components/map/CategoryFilter.tsx`): each row shows the
  category's own colour swatch + Lucide icon + localized label + a LIVE
  pin count (dimmed at 0). Counts computed in MapView (`categoryCounts`,
  grouped over loaded pins, ignores filters) and passed to FilterBar.
  Icon-name → component map in `src/lib/categories/icons.ts` (keyed by
  the seed's `icon` string, `MapPin` fallback). Markers were ALREADY
  category-coloured; only the filter UI changed.
- **Pin photo upload (old TODO #1 — DONE)** — `app/api/pins/[id]/photos`
  POST rewritten to accept bytes via the admin client (like the avatar
  route), enforce creator-only + ≤4/pin, pick extension from mime, and
  insert the `pin_photos` row atomically (rolls back the storage object
  on insert failure); DELETE now also removes the storage object.
  Display + upload UI in `src/components/pins/PinPhotos.tsx` (client
  compression, signed-URL thumbnail strip, lightbox, per-photo delete),
  wired into PinSheet `ExistingPinView`. Photos show to all members;
  upload creator-only; delete creator-or-admin. Nothing rendered
  `pin_photos` before this.
- **LINE avatar import** — the LINE picture was captured into
  `user_metadata.picture` (session.ts) then never used (avatar hard-set
  to `_pending`). Added `app/api/profile/avatar/from-line/route.ts`:
  reads the URL from the *authenticated user's own* metadata (never the
  request body — no SSRF), requires an https `*.line-scdn.net` URL,
  downloads → uploads to `avatars/<uid>/profile.jpg`. Onboarding shows a
  "Use my LINE photo" button (`AvatarUploader` `linePicture`/`lineLabel`
  props; the page passes `user_metadata.picture`). The false README
  privacy line was corrected (it had claimed Google too).
- **Community guidelines** — new `/guidelines` bilingual page
  (`guidelines` message namespace: intro + 8 numbered rules + closing),
  linked from the header nav AND the onboarding consent checkbox (now a
  rich-text `<link>`; `/guidelines` added to the middleware
  not-onboarded allow-list so it's readable mid-onboarding).
- **Anti-spam caps** — `src/lib/limits.ts` (`countUserRows`,
  `startOfUtcDay`; constants `RESOURCE_DAILY_LIMIT=3`,
  `RESOURCE_ACTIVE_LIMIT=10`, `BOARD_DAILY_LIMIT=5`). Enforced in the
  resources + board POST routes via the admin client, admins exempt
  (checked with `getCurrentClaims().user_role`); a 429 → localized
  message surfaced in both clients. The concierge count-over-window was
  the template.
- **Board/Resources presentation** — flat stacked lists replaced with
  category-grouped **collapsible sections** (`src/components/common/
  CategorySection.tsx`; header shows a count) containing **compact
  one-line rows that expand on tap**. Redundant filter-chip rows removed
  (sections replace them); Resources keeps its search + the `?res=<id>`
  deep-link (now force-opens the section and expands the row).
- **Central moderation feed** — `/admin/moderation` now covers Pins +
  Board posts + Resources (was pins-only), each Archive/Restore +
  "include archived". Goes through a new admin-gated service-role route
  `app/api/admin/moderation/route.ts` (so restore works regardless of a
  table's per-row RLS); `AdminModerationFeed` generalized to `sections`.
  NOTE: admins could ALREADY remove any item via its own Edit/Remove
  (`canManage` includes `isAdmin`), and revoke already blocks access —
  this is the central convenience, not a new capability.
- **Explainer** — new `/guide` bilingual page (`guide` namespace, 7
  sections + a link to /guidelines) plus a `HelpCircle` "?" link in the
  header (AppShell, next to the toggles). The guide content was also
  handed to Mako as paste-ready Resources how-to text (Mako seeds it
  manually per the seed-before-announce rule; not auto-created).

---

## Open issues / pending TODOs

In rough priority:

1. ~~**Photo upload UI on pin add**~~ — DONE (July 11, 2026). Photos
   route rewritten to accept bytes + enforce ≤4/creator; `PinPhotos`
   component (upload + signed-URL gallery + lightbox + delete) wired
   into the pin sheet. See the "UX + governance batch" section above.
   (Pending prod verification — map-gated, like all map changes.)
2. ~~**LINE bot group-chat mode**~~ — DECIDED (July 9, 2026): passive/
   mention-gated group Q&A stays PERMANENTLY off; the bot sits in the
   group only for the weekly digest. 1:1 chat is DONE (July 6, 2026). See
   "LINE bot 'Parea'" above. Only remaining item is a one-time
   transparency post in the group (+ a mirror `/resources` post).
3. ~~Custom domain `ourpins.app`~~ — DECIDED AGAINST (July 6, 2026).
   Not pursuing; production stays on `our-pins.vercel.app`.
4. **SMTP for magic-link emails**. Currently Supabase's default
   sender (rate-limited ~3/hr, spam-prone). Resend on the
   `onboarding@resend.dev` sender works zero-setup; Resend + verified
   domain works better (requires owning the domain).
5. **Bootstrap admin via UI instead of SQL** (old item #5). For
   future co-admins / forks of the codebase.
6. **PWA icons**. Currently uses the GOJ logo for all sizes; works
   but not optimized. If Mako wants polish, generate 192/512/maskable.
7. ~~CI workflow~~ — DONE (July 8, 2026): committed as
   `.github/workflows/ci.yml` (typecheck, lint, vitest, strict build
   on push-to-main + PRs; Playwright e2e deliberately excluded — needs
   seeded staging Supabase). Mako's gh token now has `workflow` scope
   (`gh auth refresh -s workflow`, done same day), so future workflow
   edits push normally.
8. ~~Localize new strings~~ — DONE (July 2026): all member-facing
   strings extracted to messages/{en,el}.json with Greek translations;
   admin panels intentionally left English. **July 8, 2026 follow-up**:
   category labels now localized too (new `categories` namespace keyed
   by DB slug + `src/lib/i18n/category.ts` helper, wired into FilterBar,
   PinSheet, and the 3 pin forms), and relative timestamps now pass the
   active locale in PinSheet + activity. Still open: backfill
   `translations` for pre-existing pins/vouches (script not written);
   board post *titles* still not translated; Google opening-hours text
   still comes back in the Maps-loader language.
9. **Mobile UX pass**. App is shipped but never tested on a real iOS
   device. Bottom sheets / virtual-keyboard handling / tap targets
   should be sanity-checked on iPhone. (Android/Pixel pass done July 8,
   2026 via emulated viewport: header + filter chips fixed.)
10. ~~**`pins.google_place_id` has NO unique constraint**~~ — FIXED
   (July 8, 2026, migration 0018). Partial unique index
   (`where google_place_id is not null and archived_at is null`)
   applied to cloud after verifying 0 active dups. The POST /api/pins
   23505 branch can now actually fire, and `/api/pins/by-place` was
   changed to `order+limit(1)` so it degrades gracefully rather than
   500-ing if two active pins ever share a place id.

---

## Migrations applied to the cloud DB (in order)

In `supabase/migrations/`:

- `0001` — schema (tables, extensions)
- `0002` — RLS policies (originally referenced `'role'` claim)
- `0003` — triggers (creator-auto-vouch on pin INSERT; updated_at)
- `0004` — storage bucket + policies (had a buggy avatar INSERT
  policy that used `split_part` on a non-existent path component;
  superseded by 0010)
- `0005` — pg_trgm search indexes
- `0006` — `access_token_hook` (broken; superseded by 0008)
- `0007` — `accept_invite` and `delete_user` RPCs
- `0008` — **critical fix**. Replaced auth hook to set `user_role`
  instead of overwriting Supabase's reserved `role`. Dropped + recreated
  every RLS policy that referenced `'role'` to use `'user_role'`.
- `0009` — added Bakeries & sweets, Bars & drinks, Shopping categories
- `0010` — rewrote pin-photos storage INSERT policy without the
  buggy `split_part` (matches the actual `avatars/<uid>/<file>` path)
- `0011` — security hardening per audit: rebuilt `accept_invite` to
  reject `p_user != auth.uid()`; added `is_member='true'` to
  `pins_update_owner`, `vouches_update`, `vouches_delete`,
  `pin_photos_delete`, `private_profiles_update`
- `0012` — **critical fix**. 0011 attempted column-level REVOKE on
  profiles but a broader table-level GRANT took precedence in Postgres
  so it was a no-op. 0012 revokes the table-level UPDATE and re-grants
  only `(display_name, avatar_path, display_pref, instagram, website)`.
  Verified via `information_schema.column_privileges`.
- `0013` — Concierge query log (`concierge_queries`, RLS on with no
  policies = service-role only).
- `0014` — `pins.translations` + `vouches.translations` jsonb for the
  language bridge.
- `0015` — `concierge_queries.user_id` nullable + `line_user_id` (LINE
  bot asker logging/caps). Applied to cloud July 6, 2026.
- `0016` — `profiles.bio` (+ additive column grant per the 0012
  pattern) + `board_posts` table with RLS (`user_role` claim) and
  column-restricted INSERT/UPDATE grants.
- `0017` — **critical fix**: non-admin creators couldn't soft-archive
  their own pins OR board posts (42501). PostgREST wraps UPDATE in a
  RETURNING CTE, so the NEW row must pass a SELECT policy — archiving
  made it invisible. Added `or created_by = auth.uid()` to
  pins_select and board_posts_select. Trade-off: an owner can now
  also un-archive their own row via direct API (no UI), so a
  determined member could undo an admin archive of their own content
  — accepted at this trust level.
- `0018` — partial unique index `pins_place_active_uniq` on
  `pins.google_place_id where google_place_id is not null and
  archived_at is null`. Closes the duplicate-pin gap (old TODO #10).
  Applied to cloud July 8, 2026 after verifying 0 active dups. Note:
  0016/0017 had been applied manually and were missing from the CLI
  ledger, so `supabase migration repair --status applied 0016 0017`
  was needed before `db push` would apply 0018.
- `0019` — six professional/high-stakes categories (doctors-clinics,
  dentists, lawyers-immigration, housing-real-estate, accountants-tax,
  mental-health), sort_order 90–140, insert-only. Applied to cloud
  July 8, 2026. Privacy trade-off consciously accepted: a public
  vouch in `mental-health` discloses the voucher uses those services.
- `0020` — `line_groups` (LINE group registry / weekly-digest targets;
  admin-read via `user_role='admin'`, service-role write, no member write
  path) + `digest_runs` (weekly-digest idempotency, unique per
  `(week_start, group_id)`, service-role only). Applied July 9, 2026.
- `0021` — flips `line_groups.digest_enabled` default to **false** so adding
  the bot to a group never auto-posts a digest; an admin enables it per group
  at `/admin/line-groups`. Applied July 9, 2026.
- `0022` — `resources` table (permanent library; board_posts pattern with the
  0017 lesson baked into SELECT from day one and the 0012 revoke-then-grant
  column grants; UPDATE grant includes content columns for the edit feature —
  wider than board's by design). Applied July 9, 2026; verified with 15
  minted-JWT probes against prod.
- `0023` — `resources_updated_at` trigger re-created with a WHEN clause
  (title/body/url/category changes only) so the language bridge's
  translations write doesn't bump `updated_at` and light the "edited" badge
  on every post. Applied July 9, 2026.
- `0024` — `feedback` table (bug/feature reports; member column-granted
  INSERT only, admin-only SELECT/DELETE, no UPDATE grant — immutable rows).
  Applied July 9, 2026; verified 7/7 probes.
- `0025` — extends 0023's fix to **pins, vouches, board_posts** via a
  table-agnostic WHEN clause (`to_jsonb(old/new) - 'translations' -
  'updated_at' is distinct from …`): the bridge was silently bumping
  updated_at on nearly every row of all three (latent, irreversible timestamp
  corruption — caught by the July 9 code review). Unlike 0023, archive still
  bumps (preserves prior semantics; only translations-only writes are
  excluded). Also REVOKEs anon grants on resources + feedback
  (defense-in-depth; older tables share the gap — follow-up sweep TODO).
- `0026` — adds `concierge_queries.answer` (text, nullable) so the
  Concierge log stores the model's reply next to the question. Written by
  the same service-role UPDATE in `ask.ts` that records tokens/cost;
  stays null for reserved-but-never-answered rows (guard/model failures).
  RLS-enabled-no-policies (service-role only) unchanged from 0013.
  Disclosed in the privacy policy. Applied to cloud July 9, 2026.

---

## Security model (post-audit)

A security review was run on the deploy branch. Four findings, all
fixed:

1. **Privilege escalation via self-update of profiles.role /
   is_member** — fixed by 0012 (column-level grant restriction).
   Any signed-in user could previously promote themselves to admin in
   one browser-console line; verified closed by querying
   `information_schema.column_privileges`.
2. **accept_invite RPC accepted attacker-controlled p_user** — fixed
   by 0011 (early `if p_user <> auth.uid() return 'invalid'`).
3. **Soft-delete bypass via self-update of archived_at /
   onboarded_at** — same root cause as #1; fixed by 0012.
4. **pins_update_owner allowed non-members to mutate their old
   pins** — fixed by 0011 (added `is_member='true'` check).

**Second audit (July 8, 2026)** — adversarial pass against the live
prod DB with minted per-role JWTs. All four findings above re-verified
CLOSED (self-promote → 42501, accept_invite mismatch → exception,
non-member pin edit → 0 rows, cross-tenant PII read blocked). No new
RLS/privilege holes. Robustness/consistency fixes shipped (branch
`claude/audit-fixes-2026-07-08`, deployed):
- `/api/profile` PATCH lacked the Instagram charset regex onboarding
  has → DB CHECK 500 that leaked the raw constraint name. Added regex +
  generic errors.
- `website http://…` passed Zod but violated the https-only DB CHECK →
  now normalized to `https://` in both onboarding + profile schemas.
- `/api/admin/*` is NOT covered by the middleware `/admin` gate (the
  check is `startsWith('/admin')`); any member could POST there and get
  a 500 from RLS. Added explicit admin checks (403) on the invites
  POST + DELETE.
- Raw Postgres error messages were returned verbatim from several
  routes (profile, onboarding, account/delete, admin/invites,
  by-place) → now generic + `console.error` server-side.
- display_name uniqueness check escaped LIKE wildcards; UUID guards on
  pins routes so a bad id is 404 not a 22P02 500.
- Members-grid vouch count matched to the profile page (excludes
  archived-pin vouches).
Full write-up was kept in the session scratchpad, not the repo.

**Important architecture note from the audit:** the admin client
(service_role) bypasses RLS *and* column grants, which is why several
routes use it deliberately:
- `app/api/auth/google/callback/route.ts` and `magic/callback` upsert
  profiles via admin (no INSERT policy on profiles by design).
- `app/api/onboarding/route.ts` uses admin for both
  `profiles.update(...)` (to set the privileged `onboarded_at`) and
  `private_profiles.upsert` (no INSERT policy).
- `app/api/profile/avatar/route.ts` uses admin to write to storage
  (avoids RLS entirely).
- `app/api/profile/route.ts` (PATCH for self-edit) uses the *user's*
  session client because it only touches grantable columns.

---

## Categories (current)

17, seeded in `supabase/seed.sql`:

Restaurants (10), Cafés (20), Bakeries & sweets (25), Bars & drinks
(28), Greek-product shops (30), Shopping (35), Weekend trips (40),
Things to do (50), Onsen (60), Hiking (70), Family-friendly (80),
Doctors & clinics (90), Dentists (100), Lawyers & immigration (110),
Housing & real estate (120), Accountants & tax (130), Mental health &
therapy (140) — the last six added by migration 0019 (July 8, 2026).

Frozen in v1 — no admin CRUD UI. To change: add a migration.

Deliberately NOT built (July 8, 2026): per-voucher vouch counts next
to names in the PinSheet vouch list — it's a soft credibility-ranking
signal and a pending product decision; counts already show on
/members/[id] and the members grid.

---

## Key file map (additions / changes since the original plan)

```
app/
├── api/
│   ├── auth/magic/callback/route.ts       # NEW: magic-link callback
│   ├── profile/route.ts                   # NEW: PATCH edit profile
│   └── profile/avatar/route.ts            # NEW: server-side upload via admin client
├── invite/[token]/route.ts                # CHANGED: was page.tsx; now a
│                                          # Route Handler because Next 15
│                                          # disallows cookies().set() in
│                                          # Server Components
└── settings/profile/page.tsx              # NEW: edit profile page

src/
├── components/
│   ├── auth/MagicLinkForm.tsx             # NEW: client-side magic link form
│   └── settings/ProfileEditForm.tsx       # NEW
└── lib/schemas/profile.ts                 # CHANGED: instagram/website
                                            # validation loosened; auto-prepend
                                            # https://
```

---

## Critical gotchas encountered & resolved

(Reference for future sessions so the same bugs don't get re-discovered.)

- **Auth URL config is in three places**: NEXT_PUBLIC_SITE_URL (Vercel
  env), Supabase Auth Site URL + Redirect URLs, Google Cloud OAuth
  origins + redirect URIs, and Maps API key referrers. All must agree
  for a given environment.
- **Vercel pins pnpm to `packageManager` in package.json** (pnpm 9),
  while Mako's Mac runs pnpm 11. Type resolution and lockfile behavior
  can differ — be defensive.
- **Next 15 disallows `cookies().set()` in Server Components**. Use a
  Route Handler or Server Action instead.
- **`next build` runs strict TS and lint by default**. `pnpm dev`
  doesn't. The ignore-flags that once bypassed this were removed
  July 8, 2026 — type/lint errors now gate both `pnpm build` and CI.
- **Postgres column grants vs RLS**: column-level REVOKE is a no-op
  if a broader table-level GRANT exists. Always revoke at the higher
  level first, then re-grant the specific columns you want.
- **DB CHECK constraints stay strict even after relaxing app-level
  Zod validation**. `profiles.instagram` requires NULL or matches
  `^[a-zA-Z0-9._]{1,30}$` — empty strings violate. Trim and coerce to
  null in API routes (already done in onboarding and /api/profile).
- **Middleware redirects all routes to /onboarding for users who
  haven't completed onboarding** — including `/api/profile/avatar`,
  which was breaking avatar upload during onboarding. The middleware
  allow-list now includes `/api/onboarding` AND `/api/profile/avatar`.
- **Storage policy paths**: avatar uploads go to
  `avatars/<auth.uid()>/profile.jpg` (note the subfolder; 0010 fixed
  the original schema that assumed `avatars/<uid>.<ext>`).
- **Google reserves the top-level JWT `role` claim**. App role lives
  at `user_role`.
- **Soft-archive + RLS**: PostgREST wraps every UPDATE in a RETURNING
  CTE (even `Prefer: return=minimal`), and Postgres requires the NEW
  row to pass a SELECT policy. Any policy of the shape "visible only
  while archived_at is null" makes owners unable to set archived_at
  on their own rows (42501 "new row violates row-level security").
  Keep rows SELECT-visible to their creator (`or created_by =
  auth.uid()`), as 0017 does. Test archive paths as a NON-admin —
  the admin arm masks this class of bug.
- **LINE re-sign-in bug (fixed July 8, 2026)**: for members with an
  existing line_sub mapping, the magic-link email was derived from
  `private_profiles.email` with a synthetic fallback; Supabase
  lowercases emails and matches case-insensitively, and LINE subs are
  mixed-case — so a null stored email routed the session to a
  different (orphan) auth user → /no-invite despite valid membership.
  session.ts now resolves the email from the auth user by id
  (getUserById) and backfills private_profiles.email. If LINE sign-in
  ever "loses" membership again, first check auth.users for users
  with `@line.our-pins.local` emails and no matching profiles row.
- **Minting a member JWT for API testing**: sign HS256 with
  `SUPABASE_JWT_SECRET` from `.env.local`, claims `{sub, aud:
  'authenticated', role: 'authenticated', is_member, user_role,
  onboarded, exp}` — PostgREST accepts it like a real session token.
  Lets you reproduce RLS behavior per-user without a browser.
- **After flipping `is_member` or `role`**, the user must sign out and
  back in for the JWT to refresh. Force via
  `supabase.auth.signOut(userId)` from the admin client if needed.
- **Vaul drawer: put `overflow-y-auto` on an INNER wrapper, never on
  `Drawer.Content`** (fixed July 8, 2026). Vaul injects an opaque
  `::after` overscroll mask at `top:100%` of Drawer.Content; if Content
  is itself the scroll container and its body is taller than the sheet,
  that mask lands mid-content and paints OVER lower elements — it was
  covering the "Save & vouch" submit button on the tall place-add sheet
  (invisible + unclickable, only on the tallest sheet). Keep
  Drawer.Content non-scrolling; wrap the body in
  `<div className="min-h-0 overflow-y-auto p-6">`. Absolute buttons stay
  pinned to Content as a bonus.
- **Map viewport must be read from the store at map-CREATION time, not
  the render closure** (fixed July 8, 2026). MapView's init effect read
  the `viewport` value captured at mount — before zustand-persist
  rehydrated localStorage — so the map opened at the Japan-wide default
  and the `idle` listener then wrote that default back, clobbering the
  saved position on every load. Read `useFiltersStore.getState().viewport`
  inside the async loader callback instead (post-hydration by then).
- **Maps JS API key is referrer-locked to `our-pins.vercel.app`** — the
  map will NOT load on localhost or Vercel preview URLs, so map/sheet
  changes can only be verified on prod (or after temporarily allowlisting
  the URL on the Google Cloud key). Non-map changes verify fine locally.

---

## How to use this file in a new conversation

1. Read this whole file first.
2. Ask Mako what he's working on — there's been a lot of recent work,
   and TODOs may have shifted.
3. Use git log to confirm what's actually on main vs. the feature
   branch.
4. Don't suggest setup steps that have already been done — production
   is live, OAuth is configured, RLS audit is closed, etc.
