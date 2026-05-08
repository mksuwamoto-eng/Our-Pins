import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') ?? '/';
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=${encodeURIComponent(error?.message ?? 'Google sign-in failed')}`);
  }
  return NextResponse.redirect(data.url);
}
