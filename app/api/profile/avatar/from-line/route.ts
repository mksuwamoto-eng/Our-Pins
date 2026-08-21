import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { importLineAvatar, type LineAvatarError } from '@/lib/auth/line-avatar';

const STATUS: Record<LineAvatarError, number> = {
  'no-picture': 404,
  'fetch-failed': 502,
  'unsupported-type': 415,
  'too-large': 413,
  'upload-failed': 500,
};

const MESSAGE: Record<LineAvatarError, string> = {
  'no-picture': 'No LINE photo to import',
  'fetch-failed': 'Could not fetch your LINE photo',
  'unsupported-type': 'LINE photo is an unsupported format',
  'too-large': 'LINE photo is too large',
  'upload-failed': 'Could not save your photo',
};

// Manual re-import of the LINE photo (the automatic one runs at sign-in; see
// ensureLineAvatar). The URL is read from the *authenticated* user's own auth
// metadata — never from the request body — so this can't be pointed at an
// arbitrary host.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const result = await importLineAvatar(user.id, user.user_metadata?.picture);
  if ('error' in result) {
    return NextResponse.json({ error: MESSAGE[result.error] }, { status: STATUS[result.error] });
  }
  return NextResponse.json({ path: result.path });
}
