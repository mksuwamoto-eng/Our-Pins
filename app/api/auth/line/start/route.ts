import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { buildLineAuthorizeUrl, generateNonce, generateState } from '@/lib/auth/line-jwt-bridge';
import { publicEnv } from '@/lib/env';

const STATE_COOKIE = 'our_pins_line_state';
const NONCE_COOKIE = 'our_pins_line_nonce';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') ?? '/';
  const invite = url.searchParams.get('invite');
  // LINE requires the registered redirect_uri to match exactly, so next/invite
  // ride inside the state instead of the callback URL (unlike the Google flow).
  const payload = Buffer.from(JSON.stringify({ next, invite })).toString('base64url');
  const state = `${generateState()}.${payload}`;
  const nonce = generateNonce();

  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  };
  cookieStore.set(STATE_COOKIE, state, opts);
  cookieStore.set(NONCE_COOKIE, nonce, opts);

  const redirectUri = `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/line/callback`;
  const authorize = buildLineAuthorizeUrl({ state, nonce, redirectUri });

  return NextResponse.redirect(authorize);
}
