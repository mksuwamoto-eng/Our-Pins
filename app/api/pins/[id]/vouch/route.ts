import { NextResponse, after } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translateVouchComment } from '@/lib/i18n/translate';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { comment?: string };
  const comment = typeof body.comment === 'string' && body.comment.trim().length
    ? body.comment.trim().slice(0, 500)
    : null;

  const { error } = await supabase
    .from('vouches')
    .upsert(
      // Reset translations on every write; after() refreshes them when
      // there's a comment to translate.
      { pin_id: id, voucher_id: user.id, comment, translations: null },
      { onConflict: 'pin_id,voucher_id' },
    );

  if (error) {
    console.error('vouch upsert failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  if (comment) {
    after(() => translateVouchComment(id, user.id, comment));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });

  // The creator's vouch IS the pin (the vouch_note). Removing it leaves a
  // contradictory "0 vouches but a recommendation" state — archive the pin
  // instead.
  const { data: pin } = await supabase.from('pins').select('created_by').eq('id', id).maybeSingle();
  if (pin?.created_by === user.id) {
    return new NextResponse('creators cannot un-vouch their own pin — archive it instead', {
      status: 403,
    });
  }

  const { error } = await supabase
    .from('vouches')
    .delete()
    .eq('pin_id', id)
    .eq('voucher_id', user.id);

  if (error) {
    console.error('vouch delete failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
