import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '../supabase/server';
import { INVITE_COOKIE } from '../schemas/invite';
import type { AcceptInviteResult } from '../supabase/types';

export async function consumeInviteCookie(userId: string): Promise<AcceptInviteResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITE_COOKIE)?.value;
  if (!token) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: token,
    p_user: userId,
  });

  if (error) {
    return 'invalid';
  }

  cookieStore.delete(INVITE_COOKIE);
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
