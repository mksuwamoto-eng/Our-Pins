import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { pinUpdateSchema } from '@/lib/schemas/pin';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = pinUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  // RLS handles permissions: pins_update_owner allows creator, pins_update_admin allows admins.
  const { data, error } = await supabase
    .from('pins')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return new NextResponse('not found or not allowed', { status: 404 });
  return NextResponse.json(data);
}

/**
 * Soft-archive (set archived_at = now). Use the moderation tab to hard-delete.
 * The creator can archive their own pin; admins can archive anyone's via RLS
 * (pins_update_admin policy permits the same UPDATE path).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const { data, error } = await supabase
    .from('pins')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return new NextResponse('not found or not allowed', { status: 404 });
  return NextResponse.json({ ok: true });
}
