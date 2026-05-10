import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { consumeInviteCookie } from '@/lib/auth/accept-invite';
import { publicEnv } from '@/lib/env';

// Mirrors app/api/auth/google/callback/route.ts. Magic link emails point here
// with ?code=...; the post-auth bootstrap (profile upsert + invite consume +
// session refresh) is identical to the Google flow.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=Missing+code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createSupabaseAdminClient();
    await admin.from('profiles').upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'New member',
        avatar_path: 'avatars/_pending.png',
        display_pref: 'avatar_name',
        is_member: false,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    await consumeInviteCookie(user.id);
    await supabase.auth.refreshSession();
  }

  return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}${next}`);
}
