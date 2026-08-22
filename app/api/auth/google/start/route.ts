import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') ?? '/';
  // No ?invite= passthrough: the Google path is admin-only and never grants
  // membership — see the comment in ../callback/route.ts.
  const callback = new URL(`${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`);
  callback.searchParams.set('next', next);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=${encodeURIComponent(error?.message ?? 'Google sign-in failed')}`);
  }
  return NextResponse.redirect(data.url);
}
