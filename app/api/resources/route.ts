import { NextResponse, after } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translateResource } from '@/lib/i18n/translate';
import { resourceCreateSchema } from '@/lib/schemas/resource';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = resourceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // RLS (resources_insert) enforces membership + created_by = auth.uid().
  const { data, error } = await supabase
    .from('resources')
    .insert({
      created_by: user.id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('resource insert failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  // Language bridge: translate title + body after the response is sent.
  after(() => translateResource(data.id, data.title, data.body));
  return NextResponse.json(data);
}
