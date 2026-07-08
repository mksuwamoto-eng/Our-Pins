import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) return new NextResponse('not found', { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });
  // /api/admin/* is not middleware-gated (see the POST route) — check admin here.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const { data, error } = await supabase
    .from('invites')
    .update({ expires_at: new Date(0).toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select('token');
  if (error) {
    console.error('invite revoke failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  // Token unknown, already used, or RLS-filtered — don't report a revoke
  // that never happened.
  if (!data?.length) return new NextResponse('not found or already used', { status: 404 });
  return NextResponse.json({ ok: true });
}
