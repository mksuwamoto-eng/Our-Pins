-- Storage buckets and policies. See plan §Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pin-photos', 'pin-photos', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do nothing;

-- Avatars share the pin-photos bucket under the avatars/ prefix (plan locks this
-- to keep RLS simple and quotas unified).

-- ============================================================
-- pin-photos bucket policies
-- ============================================================

-- SELECT: any member or admin
create policy pin_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'pin-photos'
    and (auth.jwt() ->> 'is_member' = 'true' or auth.jwt() ->> 'role' = 'admin')
  );

-- INSERT for avatars/<user_id>.<ext>: only the user themselves.
-- INSERT for pin-photos/<pin_id>/<photo>: only the pin's creator.
-- Path validation lives in the API route that mints the upload URL; the SQL
-- policy is the second line of defence against direct-bucket writes.
create policy pin_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'pin-photos'
    and (
      -- Avatar uploads keyed off path: avatars/<auth.uid()>.<ext>
      (
        (storage.foldername(name))[1] = 'avatars'
        and split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
      )
      or
      -- Pin photo uploads keyed off path: <pin_id>/<photo>.<ext>
      -- where pin_id's pin has created_by = auth.uid()
      (
        (storage.foldername(name))[1] is not null
        and (storage.foldername(name))[1] != 'avatars'
        and exists (
          select 1 from public.pins p
          where p.id::text = (storage.foldername(name))[1]
            and p.created_by = auth.uid()
        )
      )
    )
  );

-- DELETE: owner of the path (avatar self / pin creator) or admin.
create policy pin_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and (
      auth.jwt() ->> 'role' = 'admin'
      or (
        (storage.foldername(name))[1] = 'avatars'
        and split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
      )
      or exists (
        select 1 from public.pins p
        where p.id::text = (storage.foldername(name))[1]
          and p.created_by = auth.uid()
      )
    )
  );
