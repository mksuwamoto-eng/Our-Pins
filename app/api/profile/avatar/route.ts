import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'bad_image_type' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'image_too_large' }, { status: 400 });
  }

  const path = `avatars/${user.id}/profile.jpg`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from('pin-photos').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) {
    // Never leak raw storage errors to the client.
    console.error('[profile/avatar] upload failed', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }

  return NextResponse.json({ path });
}
