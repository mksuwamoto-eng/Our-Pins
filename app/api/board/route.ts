import { NextResponse, after } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentClaims } from '@/lib/auth/session';
import { translateBoardPost } from '@/lib/i18n/translate';
import { boardPostCreateSchema } from '@/lib/schemas/board';
import { BOARD_DAILY_LIMIT, countUserRows, startOfUtcDay } from '@/lib/limits';

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

  // Anti-spam: gentle daily rate (admins exempt). Board posts auto-expire, so
  // a daily cap alone is enough — no total-active limit.
  const claims = await getCurrentClaims();
  if (claims?.user_role !== 'admin') {
    const admin = createSupabaseAdminClient();
    const today = await countUserRows(admin, 'board_posts', user.id, { since: startOfUtcDay() });
    if (today.error) {
      console.error('board cap check failed:', today.error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
    if (today.count >= BOARD_DAILY_LIMIT) {
      return NextResponse.json({ error: 'daily_limit' }, { status: 429 });
    }
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
