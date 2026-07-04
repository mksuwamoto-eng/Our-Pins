import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
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
