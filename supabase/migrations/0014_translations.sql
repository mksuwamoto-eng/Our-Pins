-- 0014: Language bridge — store EL+EN versions of member-written text.
--
-- Members write vouches in whichever language they think in; readers see
-- them in their own. The server translates on write (Claude, via
-- next/server after()) and stores {"el": "...", "en": "..."} here — one key
-- is a verbatim copy of the original, the other a translation. NULL means
-- not translated yet (old rows, or translation failed); the UI falls back
-- to the original column.

alter table public.pins add column translations jsonb;
alter table public.vouches add column translations jsonb;
