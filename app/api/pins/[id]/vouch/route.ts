import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { comment?: string };
  const comment = typeof body.comment === 'string' && body.comment.trim().length
    ? body.comment.trim().slice(0, 500)
    : null;

  const { error } = await supabase
    .from('vouches')
    .upsert(
      { pin_id: id, voucher_id: user.id, comment },
      { onConflict: 'pin_id,voucher_id' },
    );

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const { error } = await supabase
    .from('vouches')
    .delete()
    .eq('pin_id', id)
    .eq('voucher_id', user.id);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
