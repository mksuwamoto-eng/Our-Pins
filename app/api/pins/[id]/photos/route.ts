import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 4;

/**
 * Upload a photo for a pin. Only the pin's creator may add photos (1–4/pin).
 * Bytes come through this route and are written with the admin client (same
 * model as the avatar route), which lets us enforce the per-pin cap and create
 * the pin_photos row atomically instead of relying on storage RLS alone.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: pin, error: getErr } = await supabase
    .from('pins')
    .select('id, created_by')
    .eq('id', id)
    .single();
  if (getErr || !pin) return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
  if (pin.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the pin creator can add photos' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { count, error: countErr } = await admin
    .from('pin_photos')
    .select('id', { count: 'exact', head: true })
    .eq('pin_id', id);
  if (countErr) {
    console.error('[pins/photos] count failed', countErr);
    return NextResponse.json({ error: 'Could not add photo' }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos per pin` }, { status: 409 });
  }

  const photoId = crypto.randomUUID();
  const path = `${id}/${photoId}.${ext}`;
  const { error: upErr } = await admin.storage.from('pin-photos').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (upErr) {
    console.error('[pins/photos] upload failed', upErr);
    return NextResponse.json({ error: 'Could not upload photo' }, { status: 500 });
  }

  const { data: row, error: insErr } = await admin
    .from('pin_photos')
    .insert({
      id: photoId,
      pin_id: id,
      storage_path: path,
      uploaded_by: user.id,
      sort_order: count ?? 0,
    })
    .select('id, storage_path')
    .single();
  if (insErr || !row) {
    // Don't orphan the object if the row insert fails.
    await admin.storage.from('pin-photos').remove([path]);
    console.error('[pins/photos] insert failed', insErr);
    return NextResponse.json({ error: 'Could not add photo' }, { status: 500 });
  }

  return NextResponse.json({ id: row.id, path: row.storage_path });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const photoId = url.searchParams.get('photoId');
  if (!photoId) return NextResponse.json({ error: 'photoId required' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  // RLS gates the delete (creator or admin); we surface the removed row's path
  // so we can also drop the storage object, which the old route never did.
  const { data, error } = await supabase
    .from('pin_photos')
    .delete()
    .eq('pin_id', id)
    .eq('id', photoId)
    .select('id, storage_path');
  if (error) {
    console.error('[pins/photos] delete failed', error);
    return NextResponse.json({ error: 'Could not remove photo' }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  await admin.storage.from('pin-photos').remove([data[0].storage_path]);
  return NextResponse.json({ ok: true });
}
