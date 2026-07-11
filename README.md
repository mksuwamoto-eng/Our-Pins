# Our Pins

A private, community-curated map of Japan for trusted diaspora groups.
v1: built for the Greeks-in-Japan community (~150 members) by Mako.

The codebase is MIT-licensed so other diaspora communities can fork it for
their own group. Multi-tenancy is intentionally out of scope — each community
runs its own fully independent instance.

## What's in v1

- LINE Login (primary) and Google Sign-In (fallback) via Supabase Auth
- Invite-only membership (single-use UUID tokens)
- Manual pin add via Google Places Autocomplete (Japan-restricted)
- Vouches with optional comments — creator auto-counts as first voucher
- Pin photos (1–4 per pin, private bucket, signed URLs, client-compressed)
- Member directory with per-member profile + display preferences
- Admin panel: members, invites, moderation
- Realtime map updates (new pins, live vouch counts) via Supabase Realtime
- PWA-installable, mobile-first, dark mode
- EL/EN UI via `next-intl` (forkable default locale via `i18n.config.ts`)
- Account deletion with right-to-erasure scrub
- Trigram-based fuzzy search across pins, members
- Postgres RLS using JWT custom claims (`is_member`, `role`, `onboarded`)
  injected by a Custom Access Token Hook — zero-row-lookup at policy time

## Out of v1 (deferred)

AI screenshot extraction, itineraries, leaderboard, audit-log UI, categories
CRUD UI. Also deferred: a client-side photo uploader for pins (the signed-URL
API route exists; only the UI is missing), and admin bootstrap via UI instead
of a manual SQL update (useful for co-admins or forks). See `CLAUDE.md` for
the full running list of open issues.

## Stack

- Next.js 15 (App Router, RSC), React 19, TypeScript strict
- Tailwind CSS 4, shadcn-style components, Lucide icons, Vaul sheets
- Supabase (Auth, Postgres, Storage, Realtime) — RLS-first
- `supabase-js` + `@supabase/ssr` (no ORM by design — RLS is the source of truth)
- Zustand for filter state, TanStack Query for server data
- `next-intl` (cookie locale, no URL prefix), `next-themes` for dark mode
- `react-hook-form` + `zod` for forms; shared schemas in `src/lib/schemas/`
- Vitest + Testing Library for unit, Playwright for e2e

## Fork in 10 minutes

You'll need:
- A [Supabase](https://supabase.com) project (free tier is enough for ~150 members)
- A [LINE Developers](https://developers.line.biz/console/) channel (LINE Login)
- A [Google Cloud](https://console.cloud.google.com/) project with Maps JS + Places API (New) enabled
- Supabase CLI (`brew install supabase/tap/supabase` or equivalent)

Steps:

```bash
git clone <your-fork-url> my-pins
cd my-pins
pnpm install

cp .env.example .env.local
# Fill in Supabase URL/keys, LINE creds, Google Maps key. See .env.example.

# Local Supabase (optional but recommended for dev)
pnpm db:start

# Apply migrations and seed categories
pnpm db:push
psql -h localhost -p 54322 -U postgres -f supabase/seed.sql

# Configure the access-token Auth Hook in the Supabase dashboard:
#   Authentication → Hooks → Custom Access Token → public.access_token_hook
# (Already wired in supabase/config.toml for local dev.)

# Edit i18n.config.ts — defaultLocale + locales — for your community language.
# Add messages/<your-locale>.json (copy from messages/en.json as a starting point).

# Edit supabase/seed.sql — bootstrap admin block at the bottom — with your
# auth.users.id after your first sign-in, OR use the dashboard to set
# is_member=true, role='admin' on your profiles row.

pnpm dev
```

Deploy to Vercel: connect your GitHub repo, set the same env vars, point
your domain.

## Privacy posture

- Pin photos and avatars live in a private Supabase bucket; the app fetches
  them via short-lived signed URLs only. A leaked URL expires in an hour.
- LINE sign-ins can one-click import their LINE profile photo at onboarding;
  it's only copied into our bucket when the member taps the button. Google
  sign-ins upload a photo manually (no picture default).
- `real_name` lives in a separate `private_profiles` table that members
  cannot read — only admins (and the user themselves) can SELECT it.
- Account deletion scrubs `private_profiles`, anonymises the user's display
  on retained content, and hard-deletes the `auth.users` row.

## CI workflow

Committed as `.github/workflows/ci.yml` (reproduced below). Pushing changes
to it requires GitHub `workflow` scope on the pushing account.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: dummy
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
      SUPABASE_SERVICE_ROLE_KEY: dummy
      SUPABASE_JWT_SECRET: dummy
      LINE_CHANNEL_ID: dummy
      LINE_CHANNEL_SECRET: dummy
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.14.4 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## Verification

- `pnpm typecheck && pnpm lint && pnpm test` — fast unit suite + types.
- `pnpm test:e2e` — public-page Playwright smoke; the full invite → onboard →
  add-pin → vouch flow needs a seeded staging Supabase + LINE creds (run
  manually before each release).
- Manual JP-cellular QA on iOS Safari + Android Chrome.
- See `verification` section of the plan file for the full checklist
  (race-condition test for invite consumption, RLS sanity checks, etc.).

## Day-zero LINE auth spike

Before iterating on features, prove the LINE → Supabase auth flow works
end-to-end against a throwaway Supabase project. Path B (server-side LINE
verification + Supabase magic-link bridge) is wired by default and works
without dashboard-level OIDC integration. If the spike succeeds in <1 day,
move on; if it blocks, see the plan's notes on Path A (Supabase third-party
OIDC integration) as a fallback.
