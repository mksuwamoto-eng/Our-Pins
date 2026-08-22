import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { inviteCreateSchema } from '@/lib/schemas/invite';

export async function POST(req: Request) {
  // Middleware gates /admin pages but NOT /api/admin/* (its check is
  // startsWith('/admin'), and this path is /api/admin/...). RLS already blocks
  // the insert for non-admins, but that surfaces as a 500 — check explicitly so
  // a non-admin gets a clean 403.
  const caller = await requireAdmin();
  if (!caller) return new NextResponse('forbidden', { status: 403 });
  const { supabase } = caller;

  const body = await req.json().catch(() => ({}));
  const parsed = inviteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid' }, { status: 400 });
  }

  const rows = Array.from({ length: parsed.data.count }, () => ({
    created_by: caller.userId,
    note: parsed.data.note ?? null,
    max_uses: parsed.data.maxUses,
    // Omitting expires_at falls back to the column default (14 days).
    ...(parsed.data.expiresAt ? { expires_at: parsed.data.expiresAt } : {}),
  }));

  const { data, error } = await supabase.from('invites').insert(rows).select();
  if (error) {
    console.error('invite create failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json(data);
}
