import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { inviteCreateSchema } from '@/lib/schemas/invite';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
