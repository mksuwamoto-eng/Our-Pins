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

  // Remove the member's avatar files from storage — the scrub only repoints
  // avatar_path, and orphaned photos would outlive the "data will be erased"
  // promise. Best-effort: a storage hiccup must not block the deletion.
  const admin = createSupabaseAdminClient();
  try {
    const { data: files } = await admin.storage.from('pin-photos').list(`avatars/${user.id}`);
    if (files?.length) {
      await admin.storage
        .from('pin-photos')
        .remove(files.map((f) => `avatars/${user.id}/${f.name}`));
    }
  } catch (err) {
    console.error('account delete (avatar cleanup) failed:', err);
  }

  // Then hard-delete the auth.users row using the admin client. Since 0029
  // dropped the profiles→auth.users cascade, the anonymised profiles row (and
  // the pins/vouches hanging off it) survives this, as the settings copy says.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('account delete (auth row) failed:', delErr);
    return new NextResponse('server error', { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
