import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { inviteCreateSchema } from '@/lib/schemas/invite';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  // Middleware gates /admin pages but NOT /api/admin/* (its check is
  // startsWith('/admin'), and this path is /api/admin/...). RLS already blocks
  // the insert for non-admins, but that surfaces as a 500 — check explicitly so
  // a non-admin gets a clean 403.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = inviteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid' }, { status: 400 });
  }

  const rows = Array.from({ length: parsed.data.count }, () => ({
    created_by: user.id,
    note: parsed.data.note ?? null,
  }));

  const { data, error } = await supabase.from('invites').insert(rows).select();
  if (error) {
    console.error('invite create failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json(data);
}
