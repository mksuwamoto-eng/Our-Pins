import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  // Run the SECURITY DEFINER scrub.
  const { error: rpcErr } = await supabase.rpc('delete_user', { p_user: user.id });
  if (rpcErr) {
    console.error('account delete (scrub) failed:', rpcErr);
    return new NextResponse('server error', { status: 500 });
  }

  // Then hard-delete the auth.users row using the admin client.
  const admin = createSupabaseAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('account delete (auth row) failed:', delErr);
    return new NextResponse('server error', { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
