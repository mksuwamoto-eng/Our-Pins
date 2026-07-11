import { NextResponse, after } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentClaims } from '@/lib/auth/session';
import { translateResource } from '@/lib/i18n/translate';
import { resourceCreateSchema } from '@/lib/schemas/resource';
import {
  RESOURCE_ACTIVE_LIMIT,
  RESOURCE_DAILY_LIMIT,
  countUserRows,
  startOfUtcDay,
} from '@/lib/limits';

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

  // Anti-spam caps (admins exempt): a total-active cap so the library stays
  // curated, plus a gentle daily rate. Counted via the admin client so it
  // includes the user's own archived rows for the active tally.
  const claims = await getCurrentClaims();
  if (claims?.user_role !== 'admin') {
    const admin = createSupabaseAdminClient();
    const [active, today] = await Promise.all([
      countUserRows(admin, 'resources', user.id, { activeOnly: true }),
      countUserRows(admin, 'resources', user.id, { since: startOfUtcDay() }),
    ]);
    if (active.error || today.error) {
      console.error('resource cap check failed:', active.error ?? today.error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
    if (active.count >= RESOURCE_ACTIVE_LIMIT) {
      return NextResponse.json({ error: 'active_limit' }, { status: 429 });
    }
    if (today.count >= RESOURCE_DAILY_LIMIT) {
      return NextResponse.json({ error: 'daily_limit' }, { status: 429 });
    }
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
