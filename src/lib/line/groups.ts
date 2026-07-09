import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Registry of LINE groups the bot is in — the weekly digest's push targets.
// All writes use the service-role admin client (line_groups has no member
// write path); the admin API route and webhook are the only callers.

/**
 * Discovery from any group activity: record the group if we've never seen it.
 * Never touches an existing row's admin-set label / digest_enabled / left_at —
 * this is how a group the bot joined BEFORE this code existed gets picked up
 * (the join event already fired into the void; the first message backfills it).
 */
export async function ensureLineGroup(groupId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('line_groups')
    .upsert({ group_id: groupId }, { onConflict: 'group_id', ignoreDuplicates: true });
}

/**
 * Bot added to a group (join event): (re)activate it — insert, or clear
 * left_at so a removed-then-readded group returns to the digest. Preserves the
 * admin's label and digest_enabled toggle across a re-add.
 */
export async function activateLineGroup(groupId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('line_groups')
    .upsert({ group_id: groupId, left_at: null }, { onConflict: 'group_id' });
}

/**
 * Bot removed from a group (leave event): mark it departed so the digest stops
 * targeting it. The row is kept (history + the admin's label/toggle) for if the
 * bot is added back.
 */
export async function deactivateLineGroup(groupId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('line_groups')
    .update({ left_at: new Date().toISOString() })
    .eq('group_id', groupId);
}
