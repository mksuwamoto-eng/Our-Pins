import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

// Import the profile photo captured from LINE at sign-in as the member's
// avatar. The URL is read from the *authenticated* user's own auth metadata —
// never taken from the request body — so this can't be pointed at an arbitrary
// host (no SSRF). Belt-and-braces, we also require an https LINE CDN URL.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const picture = user.user_metadata?.picture;
  if (typeof picture !== 'string' || !isLinePicture(picture)) {
    return NextResponse.json({ error: 'No LINE photo to import' }, { status: 404 });
  }

  const upstream = await fetch(picture).catch(() => null);
  if (!upstream || !upstream.ok) {
    return NextResponse.json({ error: 'Could not fetch your LINE photo' }, { status: 502 });
  }
  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: 'LINE photo is an unsupported format' }, { status: 415 });
  }
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'LINE photo is too large' }, { status: 413 });
  }

  const path = `avatars/${user.id}/profile.jpg`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from('pin-photos').upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (error) {
    console.error('[avatar/from-line] upload failed', error);
    return NextResponse.json({ error: 'Could not save your photo' }, { status: 500 });
  }

  return NextResponse.json({ path });
}

function isLinePicture(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.line-scdn.net');
  } catch {
    return false;
  }
}
