import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Build the Concierge's entire knowledge base as one text block: every live
 * pin with its creator's note and all member vouches. The community corpus is
 * small (~150 members), so we skip vector retrieval entirely and give Claude
 * the full picture — grounding is total, and prompt caching makes repeat
 * queries within the TTL cheap.
 */
export async function buildCorpus(): Promise<string> {
  const admin = createSupabaseAdminClient();

  const [{ data: pins }, { data: vouches }, { data: profiles }, { data: categories }] =
    await Promise.all([
      admin
        .from('pins')
        .select('id, name, address, prefecture, city, category_id, vouch_note, created_by, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      admin.from('vouches').select('pin_id, voucher_id, comment'),
      admin.from('profiles').select('id, display_name'),
      admin.from('categories').select('id, label'),
    ]);

  const nameOf = new Map<string, string>();
  for (const p of profiles ?? []) nameOf.set(p.id, p.display_name);
  const categoryOf = new Map<string, string>();
  for (const c of categories ?? []) categoryOf.set(c.id, c.label);
  const vouchesByPin = new Map<string, { voucher_id: string; comment: string | null }[]>();
  for (const v of vouches ?? []) {
    const list = vouchesByPin.get(v.pin_id) ?? [];
    list.push(v);
    vouchesByPin.set(v.pin_id, list);
  }

  const blocks = (pins ?? []).map((pin) => {
    const creator = nameOf.get(pin.created_by) ?? 'A former member';
    const lines = [
      `PIN id=${pin.id}`,
      `Name: ${pin.name}`,
      `Category: ${categoryOf.get(pin.category_id) ?? 'Unknown'}`,
      `Location: ${[pin.city, pin.prefecture].filter(Boolean).join(', ')} — ${pin.address}`,
      `Pinned by ${creator}: "${pin.vouch_note}"`,
    ];
    for (const v of vouchesByPin.get(pin.id) ?? []) {
      if (v.voucher_id === pin.created_by) continue; // creator auto-vouch duplicates the note
      const who = nameOf.get(v.voucher_id) ?? 'A former member';
      lines.push(v.comment ? `Vouch by ${who}: "${v.comment}"` : `Vouch by ${who} (no comment)`);
    }
    return lines.join('\n');
  });

  return blocks.join('\n\n');
}
