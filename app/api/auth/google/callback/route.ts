import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/safe-next';
import { publicEnv } from '@/lib/env';

// Reached only from the unlinked /admin-login page. Membership is LINE-only
// (see app/sign-in/page.tsx), so this path deliberately does NOT consume
// invites: an unlinked URL is not an authorization boundary, and honouring
// ?invite= here let anyone holding a legitimate invite become a member through
// Google instead of LINE, skipping the line_sub mapping the bot relies on.
// A non-admin who signs in here gets an is_member=false account and lands on
// /no-invite.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=Missing+code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Use the admin client because RLS has no INSERT policy on profiles
    // (profile creation is intentionally server-side only).
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
    // Refresh so the JWT carries the profile's current claims.
    await supabase.auth.refreshSession();
  }

  return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}${next}`);
}
