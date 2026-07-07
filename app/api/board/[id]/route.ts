import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Soft-archive a board post (set archived_at = now). RLS handles permissions:
 * board_posts_update_owner allows the author, board_posts_update_admin admins.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A non-UUID id would surface as a Postgres 22P02 → misleading 500.
  if (!UUID_RE.test(id)) return new NextResponse('not found', { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const { data, error } = await supabase
    .from('board_posts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('board post archive failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  if (!data) return new NextResponse('not found or not allowed', { status: 404 });
  return NextResponse.json({ ok: true });
}
