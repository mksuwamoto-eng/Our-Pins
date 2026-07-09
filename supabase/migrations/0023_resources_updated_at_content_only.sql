-- 0023: resources.updated_at must track member EDITS, not every row touch.
--
-- tg_set_updated_at bumps unconditionally, and the language bridge writes
-- translations (via service role) seconds after every insert — which would
-- make updated_at > created_at on every row and show the "edited" badge on
-- posts nobody edited. Restrict the bump to the member-editable content
-- columns. Translations writes and archive/restore no longer bump it —
-- correct: the badge is about content the author changed.

drop trigger resources_updated_at on public.resources;
create trigger resources_updated_at before update on public.resources
  for each row
  when (
    old.title is distinct from new.title
    or old.body is distinct from new.body
    or old.url is distinct from new.url
    or old.category is distinct from new.category
  )
  execute function public.tg_set_updated_at();
