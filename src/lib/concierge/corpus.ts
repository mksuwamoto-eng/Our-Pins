import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Build the Concierge's entire knowledge base as one text block: every live
 * pin with its creator's note and all member vouches, plus member bios and
 * active noticeboard posts. The community corpus is small (~150 members), so
 * we skip vector retrieval entirely and give Claude the full picture —
 * grounding is total, and prompt caching makes repeat queries within the TTL
 * cheap. Bios are capped at 500 chars and board posts expire after 30 days,
 * so both sections stay bounded.
 */
export async function buildCorpus(): Promise<string> {
  const admin = createSupabaseAdminClient();

  const [{ data: pins }, { data: vouches }, { data: profiles }, { data: categories }, { data: posts }] =
    await Promise.all([
      admin
        .from('pins')
        .select('id, name, address, prefecture, city, category_id, vouch_note, created_by, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      admin.from('vouches').select('pin_id, voucher_id, comment'),
      admin.from('profiles').select('id, display_name, bio'),
      admin.from('categories').select('id, label'),
      admin
        .from('board_posts')
        .select('id, category, title, body, created_by, created_at')
        .is('archived_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
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

  const bioBlocks = (profiles ?? [])
    .filter((p) => p.bio?.trim())
    .map((p) => `MEMBER\nName: ${p.display_name}\nAbout (their own words): "${p.bio!.trim()}"`);

  const postBlocks = (posts ?? []).map((post) => {
    const author = nameOf.get(post.created_by) ?? 'A former member';
    return [
      `BOARD POST`,
      `Category: ${post.category}`,
      `Title: ${post.title}`,
      `Posted by ${author} on ${post.created_at.slice(0, 10)}: "${post.body}"`,
    ].join('\n');
  });

  const sections = [`=== PLACES (pins & vouches) ===\n\n${blocks.join('\n\n')}`];
  if (bioBlocks.length) {
    sections.push(`=== MEMBERS (self-written bios) ===\n\n${bioBlocks.join('\n\n')}`);
  }
  if (postBlocks.length) {
    sections.push(
      `=== NOTICEBOARD (current community announcements: jobs, housing, for sale, events) ===\n\n${postBlocks.join('\n\n')}`,
    );
  }
  return sections.join('\n\n');
}
