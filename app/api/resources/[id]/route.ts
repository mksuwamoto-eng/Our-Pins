import { NextResponse, after } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translateResource } from '@/lib/i18n/translate';
import { resourceUpdateSchema } from '@/lib/schemas/resource';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit a resource (full replace of category/title/body/url). RLS handles
 * permissions: resources_update_owner allows the author, resources_update_admin
 * admins. The language bridge re-runs on every edit.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A non-UUID id would surface as a Postgres 22P02 → misleading 500.
  if (!UUID_RE.test(id)) return new NextResponse('not found', { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = resourceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('resources')
    .update({
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? null,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('resource update failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  if (!data) return new NextResponse('not found or not allowed', { status: 404 });
  after(() => translateResource(data.id, data.title, data.body));
  return NextResponse.json(data);
}

/**
 * Soft-archive a resource (set archived_at = now). Same RLS story as PATCH.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse('not found', { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const { data, error } = await supabase
    .from('resources')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('resource archive failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  if (!data) return new NextResponse('not found or not allowed', { status: 404 });
  return NextResponse.json({ ok: true });
}
