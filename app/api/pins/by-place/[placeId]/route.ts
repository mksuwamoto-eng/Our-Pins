import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Look up a pin by its google_place_id. Returns the pin row if one exists
 * and the user is allowed to see it (RLS-gated), else 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const supabase = await createSupabaseServerClient();
  // google_place_id has no unique constraint yet (see TODO #10), so more than
  // one active pin can share a place id. Take the oldest deterministically
  // instead of letting maybeSingle() 500 on multiple rows.
  const { data, error } = await supabase
    .from('pins')
    .select('*')
    .eq('google_place_id', placeId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('pin by-place lookup failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  const pin = data?.[0];
  if (!pin) return new NextResponse('not found', { status: 404 });
  return NextResponse.json(pin);
}
