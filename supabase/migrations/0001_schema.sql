-- Our Pins — initial schema
-- Tables: profiles, private_profiles, categories, pins, pin_photos, vouches, invites
-- See plan §Schema (revised) for the rationale on each design choice.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================
-- profiles: public-readable identity
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path text not null,
  display_pref text not null default 'avatar_name'
    check (display_pref in ('avatar_only', 'avatar_name')),
  instagram text check (instagram is null or instagram ~ '^[a-zA-Z0-9._]{1,30}$'),
  website text check (website is null or website ~* '^https://'),
  is_member boolean not null default false,
  role text not null default 'member' check (role in ('member', 'admin')),
  onboarded_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- private_profiles: admin-only PII (separate table for column-level access)
-- ============================================================
create table public.private_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  real_name text,
  email text,
  line_sub text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- categories: admin-managed (frozen in v1, reseed for forks)
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  icon text not null,
  color text not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- pins: places members vouch for
-- ============================================================
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  google_place_id text,
  address text not null,
  lat numeric(10, 7) not null,
  lng numeric(10, 7) not null,
  prefecture text not null,
  city text,
  address_components jsonb,
  category_id uuid not null references public.categories(id),
  vouch_note text not null check (char_length(vouch_note) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index pins_category_id_idx on public.pins (category_id) where archived_at is null;
create index pins_prefecture_idx on public.pins (prefecture) where archived_at is null;
create index pins_created_by_idx on public.pins (created_by) where archived_at is null;
create index pins_geo_idx on public.pins (lat, lng) where archived_at is null;
create index pins_name_trgm_idx on public.pins using gin (name gin_trgm_ops) where archived_at is null;
create index pins_note_trgm_idx on public.pins using gin (vouch_note gin_trgm_ops) where archived_at is null;

-- ============================================================
-- pin_photos: 1–4 per pin, owned by pin creator
-- ============================================================
create table public.pin_photos (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  storage_path text not null unique,
  sort_order int not null default 0,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index pin_photos_pin_id_idx on public.pin_photos (pin_id);

-- ============================================================
-- vouches: one per (pin, voucher); creator auto-vouches via trigger
-- ============================================================
create table public.vouches (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  voucher_id uuid not null references public.profiles(id) on delete cascade,
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pin_id, voucher_id)
);

create index vouches_pin_id_idx on public.vouches (pin_id);
create index vouches_voucher_id_idx on public.vouches (voucher_id);

-- ============================================================
-- invites: single-use UUID tokens
-- ============================================================
create table public.invites (
  token uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz
);

create index invites_created_by_idx on public.invites (created_by);
create index invites_used_by_idx on public.invites (used_by) where used_by is not null;

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger private_profiles_updated_at before update on public.private_profiles
  for each row execute function public.tg_set_updated_at();
create trigger pins_updated_at before update on public.pins
  for each row execute function public.tg_set_updated_at();
create trigger vouches_updated_at before update on public.vouches
  for each row execute function public.tg_set_updated_at();
