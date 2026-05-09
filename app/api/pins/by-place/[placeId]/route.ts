import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Look up a pin by its google_place_id. Returns the pin row if one exists
 * and the user is allowed to see it (RLS-gated), else 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('pins')
    .select('*')
    .eq('google_place_id', placeId)
    .is('archived_at', null)
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse('not found', { status: 404 });
  return NextResponse.json(data);
}
