import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { feedbackCreateSchema } from '@/lib/schemas/feedback';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = feedbackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // RLS (feedback_insert) enforces membership + created_by = auth.uid().
  // No .select(): members have no SELECT policy on feedback (admin-only),
  // and a RETURNING representation would be rejected.
  const { error } = await supabase.from('feedback').insert({
    created_by: user.id,
    kind: parsed.data.kind,
    body: parsed.data.body,
    page_context: parsed.data.pageContext ?? null,
  });

  if (error) {
    console.error('feedback insert failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
