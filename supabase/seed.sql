-- Seed file: spec category list with Lucide icon names + palette colors.
-- The first admin profile (Mako) is created by the LINE auth flow on first
-- login; to bootstrap, edit the marked block below with the LINE sub claim
-- you'll use, OR run the helper script in scripts/bootstrap-admin.ts after
-- your first sign-in.

insert into public.categories (slug, label, icon, color, sort_order) values
  ('restaurants',     'Restaurants',         'UtensilsCrossed', '#c9694b', 10),
  ('cafes',           'Cafés',               'Coffee',          '#d8c8a4', 20),
  ('bakeries-sweets', 'Bakeries & sweets',   'Croissant',       '#db8b6f', 25),
  ('bars-drinks',     'Bars & drinks',       'Wine',            '#213057', 28),
  ('greek-shops',     'Greek-product shops', 'ShoppingBag',     '#3a4d8a', 30),
  ('shopping',        'Shopping',            'ShoppingCart',    '#5c6ea7', 35),
  ('weekend-trips',   'Weekend trips',       'TrainFront',      '#2c3d72', 40),
  ('things-to-do',    'Things to do',        'Sparkles',        '#6e8c4f', 50),
  ('onsen',           'Onsen',               'Droplet',         '#8593c2', 60),
  ('hiking',          'Hiking',              'Mountain',        '#41552d', 70),
  ('family',          'Family-friendly',     'Users',           '#e9b29e', 80)
on conflict (slug) do nothing;

-- ============================================================
-- BOOTSTRAP ADMIN (edit before first run)
-- ============================================================
-- After your first LINE login, find your auth.users.id (e.g. via the dashboard)
-- and uncomment + run the block below to promote yourself.
--
-- update public.profiles
--   set is_member = true, role = 'admin'
--   where id = '<your-auth-user-id>';
