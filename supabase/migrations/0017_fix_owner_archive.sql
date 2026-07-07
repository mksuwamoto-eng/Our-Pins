-- 0017: let owners soft-archive their own rows.
--
-- Bug (found in user testing July 8, 2026): a non-admin creator archiving
-- their own board post — or pin — got 42501 "new row violates row-level
-- security policy". PostgREST wraps every UPDATE in a RETURNING CTE (even
-- with Prefer: return=minimal), and Postgres requires the NEW row to pass a
-- SELECT policy to be returned. Setting archived_at makes the row invisible
-- under "is_member and archived_at is null", so the owner's own archive was
-- rejected. Admins never hit it (their user_role arm ignores archived_at),
-- which is why the pins version of this bug survived launch testing.
--
-- Fix: rows stay SELECT-visible to their creator (matching profiles, which
-- always had "or id = auth.uid()"). App queries filter archived_at is null,
-- so nothing changes in any UI list; owners simply regain the ability to
-- archive — and could, in a future UI, see/restore their own archived items.

drop policy if exists pins_select on public.pins;
create policy pins_select on public.pins
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or created_by = auth.uid()
    or auth.jwt() ->> 'user_role' = 'admin'
  );

drop policy if exists board_posts_select on public.board_posts;
create policy board_posts_select on public.board_posts
  for select using (
    (auth.jwt() ->> 'is_member' = 'true' and archived_at is null)
    or created_by = auth.uid()
    or auth.jwt() ->> 'user_role' = 'admin'
  );
