# Our Pins — Project Context for New Sessions

This file is the cross-session memory for the Our Pins project. When you start
a new chat, paste this whole file in (or just say "read CLAUDE.md and pick up
from there" if the assistant has filesystem access).

The full implementation plan is at
`/root/.claude/plans/use-the-grill-me-lively-pearl.md` — but most of what's
listed there is already built. **This file supersedes the plan for current
state.**

---

## TL;DR

A private, invite-only community map of Japan for ~150 Greeks living in
Japan. Tap any place on the Google map → see vouches from the community
or be the first to vouch. Mako (the user) is the lead admin and is
building this for her group.

Repo: `mksuwamoto-eng/Our-Pins`
Active branch: `claude/build-our-pins-project-LgwVx`
Default branch: `main` (no commits there yet — branch lives only on the
feature branch)

---

## Stack snapshot

- Next.js 15.1.0 (App Router, RSC)
- React 19, TypeScript strict
- Tailwind 4 (beta), shadcn-style hand-rolled components, Lucide icons,
  Vaul bottom sheets
- Supabase: Auth, Postgres (cloud project), Storage, Realtime
- `@supabase/ssr` for the SSR cookie dance, no ORM by design
- Google Maps JS API + Places API (New) v1 — clicking POIs is the core
  flow
- Zustand for filter state, TanStack Query for server cache, next-intl
  for EL/EN, next-themes for dark mode
- Vitest + Playwright for tests

---

## Infra accounts already set up

- **Supabase project**: `soxxftpdyvlvaqkzvmxj` (URL:
  `https://soxxftpdyvlvaqkzvmxj.supabase.co`), Northeast Asia (Tokyo),
  Postgres 17, free tier. Custom Access Token JWT hook is enabled and
  points at `public.access_token_hook`.
- **Google Cloud project**: `our-pins`. APIs enabled (Maps JS, Places
  API New, Geocoding). API key restricted to HTTP referrer
  `https://ourpins.app/*` (and works from localhost too in practice).
  Billing linked via existing account. OAuth consent screen in
  **Testing** mode (100-user cap, 1 alt-email test user added).
- **LINE Developers**: not yet set up. Path B bridge code exists in
  `src/lib/auth/line-jwt-bridge.ts` and is ready, just needs the
  channel created and creds in `.env.local`.

Local credentials live in `~/code/our-pins/.env.local` on Mako's Mac.
**Never commit that file.**

---

## What works right now (verified end-to-end)

- ✅ Google sign-in via Supabase OAuth (alt email is the only allowed
  test user; Mako herself is the admin signed in via that alt account).
- ✅ Mako's profile is bootstrapped as `is_member=true`,
  `role='admin'`, `onboarded_at=now()` (manually inserted into
  `public.profiles` early on; see "Open issues" below).
- ✅ Custom JWT claims: `is_member`, `user_role`, `onboarded` injected
  by the access-token Auth Hook (Postgres function
  `public.access_token_hook`). RLS reads `auth.jwt() ->> 'user_role'`
  — there's NO `role` claim on top of Supabase's reserved `role`.
- ✅ Click any Google POI on the map → bottom sheet opens with rich
  Google data (name, address, photos, today's hours, phone,
  website, "View on Google Maps") + community section underneath.
- ✅ "Be the first to vouch" inline form when no community pin exists.
- ✅ Vouches with optional comments, relative timestamps ("2 days
  ago"), and the creator's pinned-by-me callout box.
- ✅ Pin marker click → same sheet → can vouch / un-vouch / leave a
  comment.
- ✅ Edit pin (category + vouch_note) and soft-delete (archive) for
  the pin creator OR an admin. Inline edit form replaces the sheet
  body when "Edit" is clicked.
- ✅ Admin tabs: `members` (table with promote/demote/revoke
  inline), `invites` (mint with note + count, copy link, revoke),
  `moderation` (archive/restore feed of pins, with Include archived
  toggle).
- ✅ Search-via-floating-+ flow still works as a fallback for places
  Google doesn't index.
- ✅ EL/EN i18n via cookie locale, dark mode toggle.
- ✅ Categories filter chips above the map work, server-side
  category fetch uses admin client (RLS bypass for global config).

---

## Open issues / pending TODOs (in rough priority order)

1. **Deploy to Vercel.** Currently localhost-only. Required before
   inviting the co-admin or anyone else. README has the deploy steps;
   need to also set the same env vars in the Vercel dashboard, add
   the Vercel preview URL to Google OAuth redirect URIs, and to
   Supabase's Site URL config.
2. **Invite the co-admin** (tied to the Vercel deploy).
   - Add their Gmail to Google Cloud OAuth → Test users
   - Mint an invite link from `/admin/invites`
   - DM them the link
   - First sign-in auto-creates their profile (Google callback now
     uses admin client to upsert profiles — bug fixed in commit
     `4a64fc5`)
3. **Wire up LINE Login** (Path B). Code is ready in
   `src/lib/auth/line-jwt-bridge.ts` and `app/api/auth/line/`.
   Needs LINE Channel ID + Secret in `.env.local`. LINE Login has
   no test-user cap, so it's the right primary auth before opening
   to the full 150 members.
4. **Photo upload UI on pin add.** API route + storage policies
   exist (`app/api/pins/[id]/photos/route.ts`); the client-side
   uploader component for the pin form was deferred. Avatar upload
   in onboarding works as the template to copy from.
5. **Bootstrap admin via UI instead of SQL.** Currently a fork of
   this repo would need to insert their own profile row manually.
   A small `/admin/bootstrap` page (gated by an env var or one-time
   token) would be friendlier.
6. **Next.js 15.1.0 has a known CVE** (warning shown on `pnpm
   install`). Bump to a patched 15.x before launching publicly.
7. **PWA icons** — `app/manifest.ts` references
   `/icons/icon-{192,512,maskable-512}.png` files that don't exist
   yet. Won't break the app but PWA install won't show a real icon.
8. **CI workflow** — text is in `README.md` ready to paste into
   `.github/workflows/ci.yml`. The bot account that did the initial
   commit lacked GitHub `workflow` scope.

---

## Migrations applied (in order)

In `supabase/migrations/`, all applied to the cloud project:

- `0001_schema.sql` — all tables (profiles, private_profiles,
  categories, pins, pin_photos, vouches, invites). pgcrypto +
  pg_trgm extensions.
- `0002_rls.sql` — RLS policies (originally referenced `'role'`
  claim; superseded by 0008).
- `0003_triggers.sql` — creator-auto-vouch on pin INSERT;
  updated_at trigger.
- `0004_storage.sql` — pin-photos bucket + storage policies
  (originally referenced `'role'` claim; superseded by 0008).
- `0005_search_indexes.sql` — pg_trgm GIN index on
  profiles.display_name.
- `0006_auth_hooks.sql` — `public.access_token_hook` (originally
  set top-level `role` claim — broken; superseded by 0008).
- `0007_rpc.sql` — `accept_invite` RPC, `delete_user` RPC.
- `0008_fix_role_claim.sql` — **critical fix.** Replaced the auth
  hook to set `user_role` instead of overwriting Supabase's
  reserved `role`. Dropped + recreated every RLS policy that
  referenced `auth.jwt() ->> 'role'` to use `'user_role'`.
- `0009_refine_categories.sql` — added Bakeries & sweets, Bars &
  drinks, Shopping categories.

---

## Categories (current)

11 categories seeded, sort order in parens:

1. Restaurants (10) — `#c9694b` UtensilsCrossed
2. Cafés (20) — `#d8c8a4` Coffee
3. Bakeries & sweets (25) — `#db8b6f` Croissant
4. Bars & drinks (28) — `#213057` Wine
5. Greek-product shops (30) — `#3a4d8a` ShoppingBag
6. Shopping (35) — `#5c6ea7` ShoppingCart
7. Weekend trips (40) — `#2c3d72` TrainFront
8. Things to do (50) — `#6e8c4f` Sparkles
9. Onsen (60) — `#8593c2` Droplet
10. Hiking (70) — `#41552d` Mountain
11. Family-friendly (80) — `#e9b29e` Users

Categories are frozen in v1 (no admin CRUD UI). Edit
`supabase/seed.sql` + add a migration to change.

---

## Key file map

```
app/
├── (root layouts/)
├── api/
│   ├── auth/{line,google}/{start,callback}/route.ts
│   ├── pins/route.ts                          # POST create
│   ├── pins/[id]/route.ts                     # PATCH update + DELETE soft-archive
│   ├── pins/[id]/vouch/route.ts               # POST/DELETE vouch (with comment)
│   ├── pins/[id]/photos/route.ts              # signed URL minting (only)
│   ├── pins/by-place/[placeId]/route.ts       # lookup by google_place_id
│   ├── admin/invites/...                      # mint + revoke
│   ├── account/delete/route.ts
│   └── onboarding/route.ts
├── admin/{members,invites,moderation}/        # 3 admin tabs
├── members/, settings/, sign-in/, no-invite/, invite/[token]/, onboarding/
└── pins/{[id], new}/page.tsx

src/
├── components/
│   ├── map/MapView.tsx                        # POI click + marker click
│   ├── map/PinSheet.tsx                       # bottom sheet with two modes
│   ├── map/PlaceInfoCard.tsx                  # Google data card
│   ├── map/FilterBar.tsx
│   ├── pins/{PinForm, InlineAddPinForm, PinEditForm, VouchPanel}.tsx
│   ├── admin/{AdminMembersTable, AdminInvitesPanel, AdminModerationFeed}.tsx
│   ├── onboarding/{OnboardingForm, AvatarUploader}.tsx
│   ├── settings/{SignOutButton, DeleteAccountForm}.tsx
│   ├── layout/{AppShell, LanguageToggle, ThemeToggle}.tsx
│   └── providers/QueryProvider.tsx
├── lib/
│   ├── supabase/{server, browser, middleware, realtime, types}.ts
│   ├── auth/{line-jwt-bridge, accept-invite, session}.ts
│   ├── maps/{loader, places}.ts               # singleton Loader (was a bug source)
│   ├── schemas/{pin, profile, invite}.ts      # zod
│   ├── env.ts, time.ts, utils.ts
└── stores/filters.ts                          # zustand persisted

supabase/migrations/0001..0009.sql             # see above
supabase/seed.sql                              # categories + bootstrap admin block
```

---

## Common dev workflow

```bash
cd ~/code/our-pins
git pull
pnpm dev
```

After schema changes:
```bash
supabase db push      # applies any new migrations
```

To verify env passes:
```bash
cat .env.local        # all 11 vars set, none empty (placeholders are fine for unused)
```

---

## Known quirks / things you've already discovered

- `Buffer` is not available in Edge runtime middleware — use the
  custom `decodeJwtBody` helper that uses `atob`.
- `@googlemaps/js-api-loader` is a process-wide singleton; all
  components must use the same `libraries` array. We share via
  `getMapsLoader()` in `src/lib/maps/loader.ts`.
- Supabase reserves the top-level JWT `role` claim. Don't ever
  overwrite it. Our app role lives at `user_role`.
- Categories must be fetched server-side with the admin client to
  bypass RLS — they're global config, not user data.
- Google profile callbacks need the admin client to upsert profiles
  (RLS has no INSERT policy on profiles by design).
- After flipping `is_member` or `role` on a profile, the user must
  sign out and back in for the JWT to refresh. Force via
  `supabase.auth.signOut(userId)` from the admin client if needed.
- The new Places API field mask matters for billing. We use only
  Essentials-tier fields for the basic data + Pro fields (photos,
  hours, contact) only when displaying in the sheet — careful when
  expanding queries.

---

## How to use this file in a new conversation

If you're picking this up in a fresh chat:

1. Read this whole file first.
2. The user may have made progress beyond what's documented here —
   ask them what they did since the last commit timestamp visible
   in `git log -1 --format=%ci` on the `claude/build-our-pins-project-LgwVx` branch.
3. Don't re-fetch the implementation plan unless they ask. This
   file is the source of truth for current state.
4. Don't suggest LINE / Vercel / OAuth setup steps that have
   already been done (check the "What works right now" and "Open
   issues" sections above).
