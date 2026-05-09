-- Refine the seeded category list (round 2).
-- Adds three categories that were obvious gaps: bakeries-and-sweets,
-- bars-and-drinks, general shopping. Existing pins keep their category
-- (we only INSERT new rows, never UPDATE or DELETE existing ones).

insert into public.categories (slug, label, icon, color, sort_order) values
  ('bakeries-sweets', 'Bakeries & sweets', 'Croissant',    '#db8b6f', 25),
  ('bars-drinks',    'Bars & drinks',     'Wine',         '#213057', 28),
  ('shopping',       'Shopping',          'ShoppingCart', '#5c6ea7', 35)
on conflict (slug) do nothing;
