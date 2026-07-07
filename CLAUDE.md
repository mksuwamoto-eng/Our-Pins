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
- **Active feature branch**: `claude/deploy-vercel-Lh8VI` (kept ahead
  of main; local Claude on Mako's Mac merges to main + pushes)

---

## Stack snapshot

- Next.js 15.5.18 (App Router, RSC), React 19, TypeScript strict
- `next.config.ts` has `typescript.ignoreBuildErrors: true` and
  `eslint.ignoreDuringBuilds: true` as a deploy-day shortcut — type
  errors still surface in the editor and in dev, but `next build`
  won't block on them. Worth revisiting eventually.
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

- ✅ Sign-in via **magic link** (Supabase `signInWithOtp`, custom
  callback at `/api/auth/magic/callback`). Email sender is Supabase's
  default (rate-limited ~3/hr, often lands in spam).
- ✅ Sign-in via **Google OAuth** (alt-email is the only whitelisted
  test user other than Mako himself).
- ✅ Invite flow: admin mints invite at `/admin/invites` → "Copy link"
  → friend opens link → cookie set → sign-in page → magic link or
  Google → callback consumes invite (flips `is_member=true`) → onboarding.
- ✅ Onboarding form: profile photo (optional), display name (required,
  case-insensitively unique), full name (optional, admin-only),
  Instagram + website (both optional, auto-prepends `https://`),
  community-guidelines checkbox.
- ✅ Click any Google POI on the map → bottom sheet with rich Google
  data + community vouches. "Be the first to vouch" inline form when
  no community pin exists.
- ✅ Pin marker click → same sheet → vouch / un-vouch / comment.
- ✅ Pin edit (category + vouch_note) and soft-delete (archive) for
  creator OR admin.
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
  `/api/concierge` answers questions from the community's pins/vouches
  only, via Claude (`claude-opus-4-8`), citing members by name;
  `[[pin:id|name]]` markers render as deep-links. Full-corpus prompt
  (no vector store — deliberate at this scale) with prompt caching.
  Spend caps: `concierge_queries` log table, default $10/month
  (`CONCIERGE_MONTHLY_BUDGET_USD`) + 20 queries/user/day. Migrations
  0013/0014 applied; `ANTHROPIC_API_KEY` set (per Mako, July 5, 2026).
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

## LINE bot "Parea" — 1:1 live, group chat on hold (July 6, 2026)

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

**To bring the group-chat mode live, Mako must decide + then:**

Mako is reconsidering whether the group mode should ship at all — the
concern is that even mention-gated (`@parea` only, not passive), a
public group chat used for other things could feel like noise if
several people ask restaurant questions back to back. Alternative
floated: don't add the bot to the group; instead publicize the bot's
LINE account so members reach it 1:1 individually. Decision pending —
the remaining steps below are only relevant if group mode is a go:

1. Add the bot to the Greeks-of-Japan LINE group; copy the groupId
   from the `[line/webhook] joined group:` line in Vercel logs into
   `LINE_GROUP_ID` (both envs); redeploy.
2. Test: @mention in group.

---

## Open issues / pending TODOs

In rough priority:

1. **Photo upload UI on pin add** (CLAUDE.md old item #4 — still not
   built). The signed-URL API route exists at
   `app/api/pins/[id]/photos/route.ts`; the client-side uploader was
   deferred. Avatar upload (via `/api/profile/avatar` route + admin
   client) is the template to copy from.
2. **LINE bot group-chat mode** — 1:1 is DONE and confirmed working
   (July 6, 2026); see "LINE bot 'Parea'" above. Group mode is on hold
   pending Mako's call on whether it's worth the noise vs. just
   publicizing the bot's LINE account for 1:1 use.
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
7. **CI workflow**. Text in README; needs to be committed as
   `.github/workflows/ci.yml`. Bot lacked `workflow` scope at initial
   setup; Mako can paste it manually.
8. ~~Localize new strings~~ — DONE (July 2026): all member-facing
   strings extracted to messages/{en,el}.json with Greek translations;
   admin panels intentionally left English. Also: backfill
   `translations` for pre-existing pins/vouches (script not written).
9. **Mobile UX pass**. App is shipped but never tested on a real iOS
   device. Bottom sheets / virtual-keyboard handling / tap targets
   should be sanity-checked on iPhone.

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

11, seeded in `supabase/seed.sql`:

Restaurants (10), Cafés (20), Bakeries & sweets (25), Bars & drinks
(28), Greek-product shops (30), Shopping (35), Weekend trips (40),
Things to do (50), Onsen (60), Hiking (70), Family-friendly (80).

Frozen in v1 — no admin CRUD UI. To change: add a migration.

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
  doesn't. We've set `typescript.ignoreBuildErrors: true` to unblock
  deploys; type errors live on but don't gate prod.
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
- **After flipping `is_member` or `role`**, the user must sign out and
  back in for the JWT to refresh. Force via
  `supabase.auth.signOut(userId)` from the admin client if needed.

---

## How to use this file in a new conversation

1. Read this whole file first.
2. Ask Mako what he's working on — there's been a lot of recent work,
   and TODOs may have shifted.
3. Use git log to confirm what's actually on main vs. the feature
   branch.
4. Don't suggest setup steps that have already been done — production
   is live, OAuth is configured, RLS audit is closed, etc.
