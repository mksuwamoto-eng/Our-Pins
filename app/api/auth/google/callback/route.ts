import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { consumeInviteByToken, consumeInviteCookie } from '@/lib/auth/accept-invite';
import { publicEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const inviteToken = url.searchParams.get('invite');

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
    const consumed = inviteToken ? await consumeInviteByToken(user.id, inviteToken) : null;
    if (!consumed) await consumeInviteCookie(user.id);
    // The invite consumption flipped is_member; refresh the session so the
    // new JWT claims (is_member=true) take effect immediately.
    await supabase.auth.refreshSession();
  }

  return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}${next}`);
}
