-- Our Pins — Row Level Security
-- Membership/role come from JWT custom claims (see 0006_auth_hooks.sql) so RLS
-- evaluation is zero-row-lookup. See plan §RLS (using JWT claims).

-- Helper expressions used throughout:
--   auth.jwt() ->> 'is_member' = 'true'
--   auth.jwt() ->> 'role' = 'admin'
--   auth.uid() = <row owner column>

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

-- Members can read all non-archived profiles. Admins read all.
create policy profiles_select on public.profiles
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or auth.jwt() ->> 'role' = 'admin'
    or id = auth.uid()
  );

-- Users edit their own profile. Admins can edit anyone for is_member/role toggles.
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update using (auth.jwt() ->> 'role' = 'admin');

-- Insert is server-side only (profile creation happens in onboarding via service role).

-- ============================================================
-- private_profiles
-- ============================================================
alter table public.private_profiles enable row level security;

create policy private_profiles_select on public.private_profiles
  for select using (
    auth.jwt() ->> 'role' = 'admin' or id = auth.uid()
  );

create policy private_profiles_update on public.private_profiles
  for update using (
    auth.jwt() ->> 'role' = 'admin' or id = auth.uid()
  );

-- ============================================================
-- categories
-- ============================================================
alter table public.categories enable row level security;

create policy categories_select on public.categories
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'role' = 'admin'
  );

-- v1: categories are seeded and frozen. CRUD restricted to admin.
create policy categories_admin_all on public.categories
  for all using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- pins
-- ============================================================
alter table public.pins enable row level security;

create policy pins_select on public.pins
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or auth.jwt() ->> 'role' = 'admin'
  );

create policy pins_insert on public.pins
  for insert with check (
    auth.jwt() ->> 'is_member' = 'true' and created_by = auth.uid()
  );

create policy pins_update_owner on public.pins
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy pins_update_admin on public.pins
  for update using (auth.jwt() ->> 'role' = 'admin');

create policy pins_delete_admin on public.pins
  for delete using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- pin_photos
-- ============================================================
alter table public.pin_photos enable row level security;

create policy pin_photos_select on public.pin_photos
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'role' = 'admin'
  );

-- Only the pin's creator can attach photos to it.
create policy pin_photos_insert on public.pin_photos
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.pins p
      where p.id = pin_id and p.created_by = auth.uid()
    )
  );

create policy pin_photos_delete on public.pin_photos
  for delete using (
    uploaded_by = auth.uid()
    or auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================================
-- vouches
-- ============================================================
alter table public.vouches enable row level security;

create policy vouches_select on public.vouches
  for select using (
    auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'role' = 'admin'
  );

create policy vouches_insert on public.vouches
  for insert with check (
    auth.jwt() ->> 'is_member' = 'true' and voucher_id = auth.uid()
  );

create policy vouches_update on public.vouches
  for update using (voucher_id = auth.uid())
  with check (voucher_id = auth.uid());

create policy vouches_delete on public.vouches
  for delete using (
    voucher_id = auth.uid() or auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================================
-- invites
-- ============================================================
alter table public.invites enable row level security;

-- Only admins read or write invites. Members never see them directly.
create policy invites_admin_all on public.invites
  for all using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- The accept-invite RPC runs as security definer so it can read tokens
-- without admin role; that path is the only way for non-admins to touch invites.
