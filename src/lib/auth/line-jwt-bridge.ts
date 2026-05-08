/**
 * LINE Login → Supabase session bridge (Path B from the plan).
 *
 * Flow (server-side only):
 *   1. /api/auth/line/start  generates state + PKCE, redirects to LINE.
 *   2. /api/auth/line/callback receives `code`, exchanges with LINE for an
 *      ID token, verifies signature against LINE's JWKS, and validates claims.
 *   3. We look up or create a Supabase auth.users row keyed off the LINE
 *      `sub` (stored on private_profiles for the canonical mapping), then
 *      establish a Supabase session for the user.
 *
 * On the Supabase session: we DO NOT hand-mint Supabase JWTs in v1.
 * Instead we use `supabase.auth.admin.generateLink({ type: 'magiclink' })`
 * to obtain a verified hashed_token, then `supabase.auth.verifyOtp` on the
 * client to set cookies. This stays inside Supabase's documented surface so
 * the access_token_hook fires automatically (injecting is_member + role).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getServerEnv } from '../env';

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_JWKS_URL = 'https://api.line.me/oauth2/v2.1/certs';
const LINE_ISSUER = 'https://access.line.me';

const jwks = createRemoteJWKSet(new URL(LINE_JWKS_URL));

export interface LineProfile {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
}

export function buildLineAuthorizeUrl(input: {
  state: string;
  nonce: string;
  redirectUri: string;
  codeChallenge?: string;
}): string {
  const env = getServerEnv();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINE_CHANNEL_ID,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: 'openid profile email',
    nonce: input.nonce,
  });
  if (input.codeChallenge) {
    params.set('code_challenge', input.codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeLineCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<{ idToken: string; accessToken: string }> {
  const env = getServerEnv();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: env.LINE_CHANNEL_ID,
    client_secret: env.LINE_CHANNEL_SECRET,
  });
  if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);

  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id_token: string; access_token: string };
  return { idToken: json.id_token, accessToken: json.access_token };
}

export async function verifyLineIdToken(input: {
  idToken: string;
  expectedNonce?: string;
}): Promise<LineProfile> {
  const env = getServerEnv();
  const { payload } = await jwtVerify(input.idToken, jwks, {
    issuer: LINE_ISSUER,
    audience: env.LINE_CHANNEL_ID,
  });

  if (input.expectedNonce && payload.nonce !== input.expectedNonce) {
    throw new Error('LINE ID token nonce mismatch');
  }

  return {
    sub: String(payload.sub),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

export function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateState(): string {
  return generateNonce();
}
