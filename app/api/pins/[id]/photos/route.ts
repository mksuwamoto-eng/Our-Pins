import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Returns a path under pin-photos/<pin_id>/ that the client can upload to.
 * The storage RLS policy enforces that the requesting user is the pin's creator;
 * we double-check here so we can return a clean 403 instead of a confusing storage error.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const { data: pin, error: getErr } = await supabase
    .from('pins')
    .select('id, created_by')
    .eq('id', id)
    .single();
  if (getErr || !pin) return new NextResponse('not found', { status: 404 });
  if (pin.created_by !== user.id) return new NextResponse('not the pin creator', { status: 403 });

  const photoId = crypto.randomUUID();
  const path = `${id}/${photoId}.jpg`;
  return NextResponse.json({ path, photoId });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const photoId = url.searchParams.get('photoId');
  if (!photoId) return new NextResponse('photoId required', { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('pin_photos')
    .delete()
    .eq('pin_id', id)
    .eq('id', photoId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
