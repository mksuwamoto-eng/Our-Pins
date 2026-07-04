import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { pinCreateSchema } from '@/lib/schemas/pin';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = pinCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pins')
    .insert({
      created_by: user.id,
      name: parsed.data.name,
      google_place_id: parsed.data.google_place_id ?? null,
      address: parsed.data.address,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      prefecture: parsed.data.prefecture,
      city: parsed.data.city ?? null,
      address_components: parsed.data.address_components ?? null,
      category_id: parsed.data.category_id,
      vouch_note: parsed.data.vouch_note,
    })
    .select()
    .single();

  if (error) {
    // Unique violation on google_place_id: someone pinned this place first.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This place has already been pinned by the community.' },
        { status: 409 },
      );
    }
    console.error('pin insert failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json(data);
}
