import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './src/lib/supabase/middleware';

const PUBLIC_PREFIXES = [
  '/_next',
  '/sign-in',
  '/invite',
  '/auth',
  '/api/auth',
  // Exact route, not the '/api/line' subtree: the webhook authenticates its
  // own requests (HMAC), but a future route under /api/line must not be
  // silently public.
  '/api/line/webhook',
  // Same rationale: the weekly-digest cron authenticates itself (CRON_SECRET /
  // Vercel's x-vercel-cron header), so it must bypass the session gate that
  // would otherwise 307 it to /sign-in.
  '/api/cron/digest',
  '/no-invite',
  '/privacy',
  // The PWA manifest route Next generates from app/manifest.ts. Must be listed
  // exactly: the prefix match below treats '/manifest' as '/manifest' or
  // '/manifest/…', which does NOT cover '/manifest.webmanifest', so without
  // this the manifest 307-redirects to /sign-in and the PWA install data 404s.
  '/manifest.webmanifest',
  '/icons',
  '/favicon',
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // updateSession() already called getUser() (a network round-trip) to refresh
  // the session cookie — reuse that user instead of calling getUser() a second
  // time. Saves one auth round-trip on every authenticated navigation.
  const { response, supabase, user } = await updateSession(request);

  if (isPublic(pathname)) return response;

  if (!user) {
    const signInUrl = new URL('/sign-in', request.url);
    // Keep the query string: LINE-bot deep-links arrive as /?pin=<id> and the
    // pin id must survive the sign-in round trip.
    signInUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  let isMember = false;
  let userRole = 'member';
  let onboarded = false;
  if (accessToken) {
    const claims = decodeJwtBody(accessToken);
    if (claims) {
      isMember = claims.is_member === true;
      if (typeof claims.user_role === 'string') userRole = claims.user_role;
      onboarded = claims.onboarded === true;
    }
  }

  if (pathname.startsWith('/admin')) {
    if (userRole !== 'admin') return NextResponse.redirect(new URL('/', request.url));
    return response;
  }

  if (!isMember) {
    return NextResponse.redirect(new URL('/no-invite', request.url));
  }

  if (
    !onboarded &&
    pathname !== '/onboarding' &&
    !pathname.startsWith('/api/onboarding') &&
    !pathname.startsWith('/api/profile/avatar')
  ) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

function decodeJwtBody(token: string): Record<string, unknown> | null {
  const [, body] = token.split('.');
  if (!body) return null;
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
    const decoded = decodeURIComponent(
      Array.from(json, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}
