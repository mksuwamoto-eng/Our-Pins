import { NextResponse } from 'next/server';
import { buildWeeklyDigest } from '@/lib/digest/build';
import { pushLineMessage } from '@/lib/line/messaging';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

// Pushing to several groups can take a moment.
export const maxDuration = 60;

function authorized(req: Request, secret?: string): boolean {
  // Vercel docs don't guarantee x-vercel-cron is stripped from external
  // requests, so the bearer secret is the only accepted proof. When
  // CRON_SECRET is set in the Vercel env, Vercel Cron sends it automatically
  // as `Authorization: Bearer <CRON_SECRET>`. No secret configured → fail
  // closed (every call 401s, including Vercel's own).
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
  const { data: groups, error: groupsError } = await admin
    .from('line_groups')
    .select('group_id')
    .eq('digest_enabled', true)
    .is('left_at', null);
  // Fail loudly: an unreadable registry must not read as "no groups enabled"
  // and silently swallow the week's digest.
  if (groupsError) {
    console.error('[cron/digest] group registry unreadable:', groupsError);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  const targets = (groups ?? []).map((g) => g.group_id);
  if (!targets.length) {
    return NextResponse.json({ sent: false, reason: 'no_groups', counts: digest.counts });
  }

  const itemCount =
    digest.counts.pins + digest.counts.posts + digest.counts.resources + digest.counts.members;

  // Idempotency: CLAIM the (week_start, group_id) row BEFORE pushing, and let
  // the unique index decide the winner. Reading digest_runs first and inserting
  // afterwards could not prevent duplicates — two overlapping runs both read an
  // empty set, and a push whose audit insert failed looked like it never
  // happened, so the next retry sent the digest a second time.
  // Groups are independent: one failing push must not block the others.
  const results = await Promise.allSettled(
    targets.map(async (group_id) => {
      const { error: claimError } = await admin
        .from('digest_runs')
        .insert({ week_start: digest.weekStart, group_id, item_count: itemCount });
      // 23505 = already claimed this week (a retry, or a concurrent run).
      if (claimError) {
        if (claimError.code === '23505') return 'skipped' as const;
        throw claimError;
      }
      try {
        await pushLineMessage({
          to: group_id,
          text: digest.text,
          accessToken: env.LINE_MESSAGING_ACCESS_TOKEN!,
        });
      } catch (err) {
        // Release the claim so a retry can send. Worst case the delete itself
        // fails and this group is skipped for the week — silence beats a
        // double post.
        await admin
          .from('digest_runs')
          .delete()
          .eq('week_start', digest.weekStart)
          .eq('group_id', group_id);
        throw err;
      }
      return 'posted' as const;
    }),
  );

  const posted = results.filter((r) => r.status === 'fulfilled' && r.value === 'posted').length;
  const skipped = results.filter((r) => r.status === 'fulfilled' && r.value === 'skipped').length;
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  for (const f of failed) console.error('[cron/digest] push failed:', f.reason);

  return NextResponse.json({
    sent: true,
    weekStart: digest.weekStart,
    counts: digest.counts,
    targets: targets.length,
    posted,
    skipped,
    failed: failed.length,
  });
}
