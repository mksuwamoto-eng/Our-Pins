import { createSupabaseAdminClient } from '../supabase/server';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

// profiles.avatar_path is NOT NULL, so a member without a photo carries this
// placeholder rather than null (see the sign-in bootstrap in session.ts).
export const PENDING_AVATAR = 'avatars/_pending.png';

/** The one storage path a member's avatar may occupy. */
export function ownAvatarPath(userId: string): string {
  return `avatars/${userId}/profile.jpg`;
}

/**
 * True if `path` is an avatar this user is allowed to claim.
 *
 * The client posts avatarPath back to /api/profile and /api/onboarding after
 * uploading, so it is attacker-controlled: without this, a member could point
 * their row at another member's photo. Migration 0033 enforces the same shape
 * as a CHECK constraint; this exists so the answer is a clean 400 rather than
 * a constraint violation surfacing as a 500.
 */
export function isOwnAvatarPath(path: string, userId: string): boolean {
  return path === PENDING_AVATAR || path === ownAvatarPath(userId);
}

/**
 * Only ever fetch a LINE CDN URL over https. Callers must source the URL from
 * the user's own auth metadata (written at sign-in), never from request input —
 * together those two rules keep this from becoming an SSRF primitive.
 */
export function isLinePicture(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.line-scdn.net');
  } catch {
    return false;
  }
}

export type LineAvatarError =
  | 'no-picture'
  | 'fetch-failed'
  | 'unsupported-type'
  | 'too-large'
  | 'upload-failed';

/**
 * Download the member's LINE profile photo and store it as their avatar.
 * Returns the storage path on success, or a machine-readable reason on failure
 * so HTTP callers can map it to a status code.
 */
export async function importLineAvatar(
  userId: string,
  picture: unknown,
): Promise<{ path: string } | { error: LineAvatarError }> {
  if (typeof picture !== 'string' || !isLinePicture(picture)) {
    return { error: 'no-picture' };
  }

  const upstream = await fetch(picture).catch(() => null);
  if (!upstream || !upstream.ok) return { error: 'fetch-failed' };

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!ALLOWED.has(contentType)) return { error: 'unsupported-type' };

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return { error: 'too-large' };

  const path = `avatars/${userId}/profile.jpg`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from('pin-photos').upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (error) {
    console.error('[line-avatar] upload failed', error);
    return { error: 'upload-failed' };
  }
  return { path };
}

/**
 * Give a LINE member their LINE photo automatically, unless they already have
 * an avatar of their own. Runs on every LINE sign-in, so members who joined
 * before this existed pick up a photo the next time they open the app; once
 * avatar_path is anything but the placeholder, this is a no-op and a member's
 * later choice of photo is never overwritten.
 *
 * Never throws: a failed import must not break sign-in.
 */
export async function ensureLineAvatar(userId: string, picture: unknown): Promise<void> {
  try {
    if (typeof picture !== 'string' || !isLinePicture(picture)) return;

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('avatar_path, is_member')
      .eq('id', userId)
      .maybeSingle();

    // Members only: someone who taps "Sign in with LINE" without an invite
    // must not leave their photo in our storage.
    if (!profile || !profile.is_member) return;
    if (profile.avatar_path !== PENDING_AVATAR) return;

    const result = await importLineAvatar(userId, picture);
    if ('error' in result) {
      console.error('[line-avatar] auto-import skipped:', result.error);
      return;
    }
    await admin.from('profiles').update({ avatar_path: result.path }).eq('id', userId);
  } catch (err) {
    console.error('[line-avatar] auto-import failed', err);
  }
}
