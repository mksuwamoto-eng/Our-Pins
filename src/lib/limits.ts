import type { createSupabaseAdminClient } from '@/lib/supabase/server';

// Soft anti-spam caps (admins are exempt — enforced at the call site).
// Resources are a permanent library, so they get a total-active cap plus a
// gentle daily rate; board posts auto-expire, so a daily rate alone is enough.
export const RESOURCE_DAILY_LIMIT = 3;
export const RESOURCE_ACTIVE_LIMIT = 10;
export const BOARD_DAILY_LIMIT = 5;

export function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Count rows in `table` authored by `userId`, optionally within a time window
 * and/or only non-archived. Parameterized so the resource and board caps share
 * one query shape instead of each route hand-rolling its own count.
 */
export async function countUserRows(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: 'resources' | 'board_posts',
  userId: string,
  opts: { since?: Date; activeOnly?: boolean } = {},
): Promise<{ count: number; error: unknown }> {
  let q = admin.from(table).select('id', { count: 'exact', head: true }).eq('created_by', userId);
  if (opts.since) q = q.gte('created_at', opts.since.toISOString());
  if (opts.activeOnly) q = q.is('archived_at', null);
  const { count, error } = await q;
  return { count: count ?? 0, error };
}
