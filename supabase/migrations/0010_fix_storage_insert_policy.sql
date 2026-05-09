-- 0010: clean rewrite of the storage INSERT policy.
--
-- The original policy in 0004 split the avatar filename to handle
-- "avatars/<uuid>.<ext>", but the actual upload path is now
-- "avatars/<uuid>/<filename>". The split_part trick was a leftover
-- and not strictly needed for the new path layout. Production was
-- still rejecting valid avatar uploads with a 403; replacing with a
-- direct equality check on the second folder removes the ambiguity.

drop policy if exists pin_photos_storage_insert on storage.objects;

create policy pin_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'pin-photos'
    and (
      -- Avatar uploads: avatars/<auth.uid()>/<anything>
      (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or
      -- Pin photo uploads: <pin_id>/<filename>, only by the pin's creator.
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

-- Mirror the same simplification for DELETE so admins / owners can
-- still clean up avatars. (The 0008 version kept the split_part trick.)

drop policy if exists pin_photos_storage_delete on storage.objects;

create policy pin_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and (
      auth.jwt() ->> 'user_role' = 'admin'
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or exists (
        select 1 from public.pins p
        where p.id::text = (storage.foldername(name))[1]
          and p.created_by = auth.uid()
      )
    )
  );
