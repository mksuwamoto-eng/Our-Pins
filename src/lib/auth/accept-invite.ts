import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '../supabase/server';
import { INVITE_COOKIE } from '../schemas/invite';
import type { AcceptInviteResult } from '../supabase/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function consumeInviteCookie(userId: string): Promise<AcceptInviteResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITE_COOKIE)?.value;
  if (!token) return null;
  return consumeInviteToken(userId, token);
}

// Consume an invite token passed via URL (e.g. magic-link callback). The
// cookie path is fragile across the 30-min TTL, cross-device sign-ins, and
// Safari ITP — the URL form survives all of those.
export async function consumeInviteByToken(
  userId: string,
  token: string,
): Promise<AcceptInviteResult | null> {
  if (!UUID_RE.test(token)) return 'invalid';
  return consumeInviteToken(userId, token);
}

async function consumeInviteToken(
  userId: string,
  token: string,
): Promise<AcceptInviteResult | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: token,
    p_user: userId,
  });

  // Always clear any lingering cookie — we've either consumed the invite
  // or proven it's bad.
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE);

  if (error) return 'invalid';
  return data as AcceptInviteResult;
}

export async function setInviteCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 30,
  });
}
