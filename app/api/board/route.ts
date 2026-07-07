import { NextResponse, after } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translateBoardPost } from '@/lib/i18n/translate';
import { boardPostCreateSchema } from '@/lib/schemas/board';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = boardPostCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // RLS (board_posts_insert) enforces membership + created_by = auth.uid().
  const { data, error } = await supabase
    .from('board_posts')
    .insert({
      created_by: user.id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select()
    .single();

  if (error) {
    console.error('board post insert failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  // Language bridge: translate the body after the response is sent.
  after(() => translateBoardPost(data.id, data.body));
  return NextResponse.json(data);
}
