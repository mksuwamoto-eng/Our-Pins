import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getCurrentClaims } from '@/lib/auth/session';

const TABLES = new Set(['pins', 'board_posts', 'resources']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin archive/restore across content types. Uses the service-role client so
 * it works uniformly regardless of each table's per-row RLS (some tables only
 * expose archived rows to their creator, which would block a browser-client
 * restore). Admin-gated here; /api/admin/* is NOT covered by the middleware
 * /admin gate, so the check must live in-route.
 */
export async function POST(req: Request) {
  const claims = await getCurrentClaims();
  if (claims?.user_role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    table?: string;
    id?: string;
    archive?: boolean;
  } | null;
  if (!body || !body.table || !TABLES.has(body.table) || !body.id || !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from(body.table)
    .update({ archived_at: body.archive ? new Date().toISOString() : null })
    .eq('id', body.id);
  if (error) {
    console.error('[admin/moderation] update failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
