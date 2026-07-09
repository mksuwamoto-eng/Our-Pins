-- 0025: stop the language bridge from corrupting updated_at on pins, vouches,
-- and board_posts — the same bug 0023 fixed for resources, at the right
-- altitude this time. The bridge's service-role translations write fires
-- seconds after nearly every insert, so updated_at > created_at on almost
-- every row and the true last-edit timestamp is being silently destroyed.
-- Nothing reads these columns yet (only resources has an "edited" badge),
-- but the damage is irreversible once real edits mix in — fix while the
-- bumped data is hours old.
--
-- Unlike 0023's explicit column list, these tables keep their existing
-- semantics for every OTHER column (archive still bumps, as today); only a
-- translations-only change is excluded. jsonb-minus-key comparison keeps the
-- WHEN clause table-agnostic.

drop trigger pins_updated_at on public.pins;
create trigger pins_updated_at before update on public.pins
  for each row
  when ((to_jsonb(old) - 'translations' - 'updated_at')
    is distinct from (to_jsonb(new) - 'translations' - 'updated_at'))
  execute function public.tg_set_updated_at();

drop trigger vouches_updated_at on public.vouches;
create trigger vouches_updated_at before update on public.vouches
  for each row
  when ((to_jsonb(old) - 'translations' - 'updated_at')
    is distinct from (to_jsonb(new) - 'translations' - 'updated_at'))
  execute function public.tg_set_updated_at();

drop trigger board_posts_updated_at on public.board_posts;
create trigger board_posts_updated_at before update on public.board_posts
  for each row
  when ((to_jsonb(old) - 'translations' - 'updated_at')
    is distinct from (to_jsonb(new) - 'translations' - 'updated_at'))
  execute function public.tg_set_updated_at();

-- Defense-in-depth: Supabase's default privileges also grant table access to
-- anon. RLS blocks anon today (no policy matches a null auth.uid()), but the
-- grant layer should not be one policy edit away from exposure — the 0012
-- lesson applied to the anon role. Covers the two tables this batch created;
-- older tables share the gap and can be swept in a follow-up.
revoke all on public.resources from anon;
revoke all on public.feedback from anon;
