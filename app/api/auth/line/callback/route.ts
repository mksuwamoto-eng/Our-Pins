import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { exchangeLineCode, verifyLineIdToken } from '@/lib/auth/line-jwt-bridge';
import {
  generateMagicLinkVerification,
  upsertUserFromLine,
} from '@/lib/auth/session';
import { consumeInviteCookie } from '@/lib/auth/accept-invite';
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

  const next = decodeURIComponent(state.split('.')[1] ?? '/');
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

    // If an invite cookie is present, consume it now (sets is_member=true).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await consumeInviteCookie(user.id);
    }

    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}${next}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed';
    return redirectToSignIn(message);
  }
}

function redirectToSignIn(error: string) {
  const url = new URL('/sign-in', publicEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
