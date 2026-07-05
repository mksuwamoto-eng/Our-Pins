import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { exchangeLineCode, verifyLineIdToken } from '@/lib/auth/line-jwt-bridge';
import {
  generateMagicLinkVerification,
  upsertUserFromLine,
} from '@/lib/auth/session';
import { consumeInviteByToken, consumeInviteCookie } from '@/lib/auth/accept-invite';
import { publicEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const STATE_COOKIE = 'our_pins_line_state';
const NONCE_COOKIE = 'our_pins_line_nonce';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const expectedNonce = cookieStore.get(NONCE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NONCE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToSignIn('Invalid auth state. Please try again.');
  }

  let next = '/';
  let inviteToken: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(state.split('.')[1] ?? '', 'base64url').toString('utf8'));
    if (typeof payload.next === 'string') next = payload.next;
    if (typeof payload.invite === 'string') inviteToken = payload.invite;
  } catch {
    // fall through with defaults
  }
  const redirectUri = `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/line/callback`;

  try {
    const { idToken } = await exchangeLineCode({ code, redirectUri });
    const profile = await verifyLineIdToken({ idToken, expectedNonce });

    const { email } = await upsertUserFromLine(profile);
    const props = await generateMagicLinkVerification(email);

    // Establish the session by hitting the verify endpoint server-side.
    const supabase = await createSupabaseServerClient();
    if (props && 'hashed_token' in props && typeof props.hashed_token === 'string') {
      const { error } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: props.hashed_token,
      });
      if (error) {
        return redirectToSignIn(`Sign-in failed: ${error.message}`);
      }
    }

    // Consume the invite (sets is_member=true), preferring the state-borne
    // token, then refresh so the new JWT carries the is_member claim.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const consumed = inviteToken ? await consumeInviteByToken(user.id, inviteToken) : null;
      if (!consumed) await consumeInviteCookie(user.id);
      await supabase.auth.refreshSession();
    }

    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}${next}`);
  } catch (err) {
    console.error('[line/callback]', err);
    return redirectToSignIn('Sign-in failed');
  }
}

function redirectToSignIn(error: string) {
  const url = new URL('/sign-in', publicEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
