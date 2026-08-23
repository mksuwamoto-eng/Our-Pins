import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { isTagSlug, TAG_CORPUS_LABELS } from '@/lib/tags';

/**
 * Build the Concierge's entire knowledge base as one text block: every live
 * pin with its creator's note and all member vouches, plus member bios,
 * active noticeboard posts, and library resources (excerpt-only — see
 * below). The community corpus is small (~150 members), so
 * we skip vector retrieval entirely and give Claude the full picture —
 * grounding is total, and prompt caching makes repeat queries within the TTL
 * cheap. Bios are capped at 500 chars and board posts expire after 30 days,
 * so both sections stay bounded.
 */
/**
 * Resources are permanent, so unlike board posts nothing expires out of this
 * section. Two bounds keep it flat anyway: the body is cut to an excerpt
 * (matching needs a scent of the content, and Parea is a librarian — she
 * points at posts, she doesn't teach from them, so the full how-to steps
 * deliberately never enter the prompt), and at ~150 members the post count
 * stays small for years.
 */
const RESOURCE_EXCERPT_CHARS = 400;

export async function buildCorpus(): Promise<string> {
  const admin = createSupabaseAdminClient();

  const results = await Promise.all([
      admin
        .from('pins')
        .select('id, name, address, prefecture, city, category_id, tags, vouch_note, created_by, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      admin.from('vouches').select('pin_id, voucher_id, comment'),
      // Members only: revoked/deleted members and invite-less sign-ins must not
      // be named (or have their bios quoted) by Parea — the UI anonymises them
      // as "Former member", and the corpus has to match what members can see.
      admin.from('profiles').select('id, display_name, bio').eq('is_member', true).is('archived_at', null),
      admin.from('categories').select('id, label'),
      admin
        .from('board_posts')
        .select('id, category, title, body, created_by, created_at')
        .is('archived_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      admin
        .from('resources')
        .select('id, category, title, body, url, translations, created_by, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
    ]);

  // A failed query would hand Parea a corpus that is missing a whole section
  // while looking complete, and she would answer confidently from it ("nobody
  // has pinned anything in Osaka"). Fail closed instead — the caller turns
  // this into a 'model_error' the member can retry.
  const corpusError = results.find((r) => r.error)?.error;
  if (corpusError) {
    throw new Error(`concierge corpus query failed: ${corpusError.message}`);
  }
  const [
    { data: pins },
    { data: vouches },
    { data: profiles },
    { data: categories },
    { data: posts },
    { data: resources },
  ] = results;

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
    // The second axis (src/lib/tags). At most 3 short slugs per pin, so this
    // stays bounded — no prompt-size drift. Omitted entirely when empty.
    const tagLabels = ((pin.tags ?? []) as string[])
      .filter(isTagSlug)
      .map((tag) => TAG_CORPUS_LABELS[tag]);
    if (tagLabels.length) lines.splice(3, 0, `Tags: ${tagLabels.join('; ')}`);
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

  const resourceBlocks = (resources ?? []).map((r) => {
    const author = nameOf.get(r.created_by) ?? 'A former member';
    // Both language versions of the title go in so a Greek question matches
    // an English-titled post and vice versa. The body is excerpt-only (see
    // RESOURCE_EXCERPT_CHARS above).
    const tr = r.translations as { title?: { el?: string; en?: string } } | null;
    const altTitle = [tr?.title?.el, tr?.title?.en].find((t) => t && t.trim() !== r.title.trim());
    // Cut on code points, not UTF-16 units — slicing through a surrogate pair
    // would put a lone surrogate in the prompt, which the API rejects (and one
    // bad permanent post would break every concierge query).
    const excerpt =
      r.body.length > RESOURCE_EXCERPT_CHARS
        ? `${[...r.body].slice(0, RESOURCE_EXCERPT_CHARS).join('')}…`
        : r.body;
    const lines = [
      `RESOURCE id=${r.id}`,
      `Category: ${r.category}`,
      `Title: ${r.title}`,
    ];
    if (altTitle) lines.push(`Also titled: ${altTitle}`);
    if (r.url) lines.push(`Link: ${r.url}`);
    lines.push(`Shared by ${author} on ${r.created_at.slice(0, 10)}`);
    lines.push(`Excerpt (for matching only — NOT the full content): "${excerpt}"`);
    return lines.join('\n');
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
  if (resourceBlocks.length) {
    sections.push(
      `=== RESOURCES (permanent member-posted library: how-tos, things to watch, things to read) ===\n\n${resourceBlocks.join('\n\n')}`,
    );
  }
  return sections.join('\n\n');
}
