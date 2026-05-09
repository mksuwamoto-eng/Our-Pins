import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './src/lib/supabase/middleware';

const PUBLIC_PREFIXES = [
  '/_next',
  '/sign-in',
  '/invite',
  '/auth',
  '/api/auth',
  '/no-invite',
  '/manifest',
  '/icons',
  '/favicon',
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, supabase } = await updateSession(request);

  if (isPublic(pathname)) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
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

  if (!onboarded && pathname !== '/onboarding' && !pathname.startsWith('/api/onboarding')) {
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
