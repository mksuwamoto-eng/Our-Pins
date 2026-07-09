import { NextResponse } from 'next/server';
import { buildWeeklyDigest } from '@/lib/digest/build';
import { pushLineMessage } from '@/lib/line/messaging';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

// Pushing to several groups can take a moment.
export const maxDuration = 60;

function authorized(req: Request, secret?: string): boolean {
  // Vercel Cron invocations carry this header (set internally by Vercel, not
  // spoofable from the public internet). Otherwise require the bearer secret.
  if (req.headers.get('x-vercel-cron')) return true;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: Request) {
  const env = getServerEnv();
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const isDev = process.env.NODE_ENV !== 'production';

  // A localhost dry-run is open (for previewing the text); in production every
  // call — dry or not — must be authorized.
  if (!(dry && isDev) && !authorized(req, env.CRON_SECRET)) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  if (!env.LINE_MESSAGING_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 503 });
  }

  const digest = await buildWeeklyDigest();

  // Preview: return the computed digest without posting.
  if (dry) return NextResponse.json({ dry: true, ...digest });

  if (!digest.send) {
    return NextResponse.json({ sent: false, reason: 'below_threshold', counts: digest.counts });
  }

  const admin = createSupabaseAdminClient();
  const { data: groups } = await admin
    .from('line_groups')
    .select('group_id')
    .eq('digest_enabled', true)
    .is('left_at', null);
  const targets = (groups ?? []).map((g) => g.group_id);
  if (!targets.length) {
    return NextResponse.json({ sent: false, reason: 'no_groups', counts: digest.counts });
  }

  // Idempotency: skip groups already posted to this week (retry-safe).
  const { data: done } = await admin
    .from('digest_runs')
    .select('group_id')
    .eq('week_start', digest.weekStart)
    .in('group_id', targets);
  const alreadyDone = new Set((done ?? []).map((d) => d.group_id));
  const itemCount = digest.counts.pins + digest.counts.posts + digest.counts.members;

  // Groups are independent — one failing push must not block the others.
  const results = await Promise.allSettled(
    targets
      .filter((id) => !alreadyDone.has(id))
      .map(async (group_id) => {
        await pushLineMessage({
          to: group_id,
          text: digest.text,
          accessToken: env.LINE_MESSAGING_ACCESS_TOKEN!,
        });
        await admin
          .from('digest_runs')
          .insert({ week_start: digest.weekStart, group_id, item_count: itemCount });
        return group_id;
      }),
  );

  const posted = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  for (const f of failed) console.error('[cron/digest] push failed:', f.reason);

  return NextResponse.json({
    sent: true,
    weekStart: digest.weekStart,
    counts: digest.counts,
    targets: targets.length,
    posted,
    skipped: targets.length - (posted + failed.length),
    failed: failed.length,
  });
}
