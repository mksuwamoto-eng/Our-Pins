-- Professional / high-stakes categories (round 3).
-- Trust-weighted recommendations matter most where the stakes are high:
-- finding a doctor, dentist, or lawyer who speaks your language. Existing
-- rows are never UPDATEd or DELETEd (same rule as 0009); sort_order
-- continues past the current max (80) so nothing renumbers.
--
-- NOTE for review before `db push`: vouches are public and attributed, so a
-- vouch in `mental-health` discloses that the voucher uses mental-health
-- services — in a ~150-person community that may be more disclosure than
-- people intend. Drop that line if the trade-off isn't acceptable.

insert into public.categories (slug, label, icon, color, sort_order) values
  ('doctors-clinics',     'Doctors & clinics',       'Stethoscope',    '#a05252', 90),
  ('dentists',            'Dentists',                'Smile',          '#8ea3cf', 100),
  ('lawyers-immigration', 'Lawyers & immigration',   'Scale',          '#4a3d72', 110),
  ('housing-real-estate', 'Housing & real estate',   'KeyRound',       '#8c6f4f', 120),
  ('accountants-tax',     'Accountants & tax',       'Calculator',     '#46618c', 130),
  ('mental-health',       'Mental health & therapy', 'HeartHandshake', '#7d9b8a', 140)
on conflict (slug) do nothing;
