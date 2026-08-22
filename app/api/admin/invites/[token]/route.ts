import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) return new NextResponse('not found', { status: 404 });
  // /api/admin/* is not middleware-gated (see the POST route) — check admin here.
  const caller = await requireAdmin();
  if (!caller) return new NextResponse('forbidden', { status: 403 });
  const { supabase } = caller;

  // Revoke explicitly rather than by back-dating expires_at (which made a
  // naturally-expired invite indistinguishable from a revoked one). Guarding on
  // revoked_at rather than used_at means a partly-used multi-use link can still
  // be shut off — under the old guard, one redemption made a link unrevokable.
  const { data, error } = await supabase
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .is('revoked_at', null)
    .select('token');
  if (error) {
    console.error('invite revoke failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  // Token unknown, already revoked, or RLS-filtered — don't report a revoke
  // that never happened.
  if (!data?.length) return new NextResponse('not found or already revoked', { status: 404 });
  return NextResponse.json({ ok: true });
}
