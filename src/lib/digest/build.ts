import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import enMessages from '../../../messages/en.json';
import elMessages from '../../../messages/el.json';

// The weekly digest is a DETERMINISTIC template (no LLM): it lists what's new
// since the window, links back into the app to pull members in, and is skipped
// entirely on quiet weeks so it never reads as noise. It's bilingual — place,
// member and board-post text are proper nouns / author-written, so only the
// section headers and category tags need EL+EN.

const WINDOW_DAYS = 7;
const MAX_PINS = 8;
const MAX_POSTS = 6;
const MAX_RESOURCES = 6;
const MAX_MEMBERS = 8;

const SITE = publicEnv.NEXT_PUBLIC_SITE_URL;
const enCat = enMessages.categories as Record<string, string>;
const elCat = elMessages.categories as Record<string, string>;
const enBoard = enMessages.board as Record<string, string>;
const elBoard = elMessages.board as Record<string, string>;
const enRes = enMessages.resources as Record<string, string>;
const elRes = elMessages.resources as Record<string, string>;

/** "Καφέ / Cafés" when the labels differ, else just the one. */
function bilingual(el: string | undefined, en: string | undefined): string {
  const a = el?.trim();
  const b = en?.trim();
  if (a && b && a !== b) return `${a} / ${b}`;
  return a || b || '';
}

function categoryLabel(slug: string): string {
  return bilingual(elCat[slug], enCat[slug]) || slug;
}

function boardCategoryLabel(cat: string): string {
  const key = `category_${cat}`;
  return bilingual(elBoard[key], enBoard[key]) || cat;
}

function resourceCategoryLabel(cat: string): string {
  const key = `category_${cat}`;
  return bilingual(elRes[key], enRes[key]) || cat;
}

export interface DigestResult {
  /** True when there's enough new content to be worth posting. */
  send: boolean;
  /** UTC date (YYYY-MM-DD) identifying this run, for idempotency. */
  weekStart: string;
  /** The rendered bilingual message (built even when send is false, for preview). */
  text: string;
  counts: { pins: number; posts: number; resources: number; members: number };
}

export async function buildWeeklyDigest(now: Date = new Date()): Promise<DigestResult> {
  const admin = createSupabaseAdminClient();
  const windowStartISO = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const nowISO = now.toISOString();

  const [{ data: pins }, { data: posts }, { data: resources }, { data: members }, { data: categories }] =
    await Promise.all([
      admin
        .from('pins')
        .select('id, name, category_id, created_at')
        .is('archived_at', null)
        .gte('created_at', windowStartISO)
        .order('created_at', { ascending: false }),
      admin
        .from('board_posts')
        .select('id, category, title, created_at')
        .is('archived_at', null)
        .gt('expires_at', nowISO)
        .gte('created_at', windowStartISO)
        .order('created_at', { ascending: false }),
      admin
        .from('resources')
        .select('id, category, title, created_at')
        .is('archived_at', null)
        .gte('created_at', windowStartISO)
        .order('created_at', { ascending: false }),
      admin
        .from('profiles')
        .select('id, display_name, onboarded_at')
        .eq('is_member', true)
        .is('archived_at', null)
        .gte('onboarded_at', windowStartISO)
        .order('onboarded_at', { ascending: false }),
      admin.from('categories').select('id, slug'),
    ]);

  const slugOf = new Map((categories ?? []).map((c) => [c.id, c.slug]));
  const newPins = pins ?? [];
  const newPosts = posts ?? [];
  const newResources = resources ?? [];
  const newMembers = members ?? [];

  const counts = {
    pins: newPins.length,
    posts: newPosts.length,
    resources: newResources.length,
    members: newMembers.length,
  };
  // Gate: any new noticeboard post or library resource is worth a post on its
  // own (the whole point is that they don't go unseen); otherwise require ≥2
  // new items so a single stray pin doesn't trigger a near-empty digest.
  const total = counts.pins + counts.posts + counts.resources + counts.members;
  const send = counts.posts >= 1 || counts.resources >= 1 || total >= 2;

  const lines: string[] = ['📍 Our Pins — Εβδομαδιαία σύνοψη / Weekly digest'];

  if (newPins.length) {
    lines.push('', `📌 Νέα μέρη / New places (${newPins.length})`);
    for (const p of newPins.slice(0, MAX_PINS)) {
      lines.push(`• ${p.name} — ${categoryLabel(slugOf.get(p.category_id) ?? '')}`);
    }
    if (newPins.length > MAX_PINS) lines.push(`  …κι άλλα ${newPins.length - MAX_PINS} / +${newPins.length - MAX_PINS} more`);
  }

  if (newPosts.length) {
    lines.push('', `📣 Πίνακας ανακοινώσεων / Noticeboard (${newPosts.length})`);
    for (const post of newPosts.slice(0, MAX_POSTS)) {
      lines.push(`• [${boardCategoryLabel(post.category)}] ${post.title}`);
    }
    if (newPosts.length > MAX_POSTS) lines.push(`  …κι άλλα ${newPosts.length - MAX_POSTS} / +${newPosts.length - MAX_POSTS} more`);
    lines.push(`👉 ${SITE}/board`);
  }

  if (newResources.length) {
    lines.push('', `📚 Χρήσιμα / Resources (${newResources.length})`);
    for (const r of newResources.slice(0, MAX_RESOURCES)) {
      lines.push(`• [${resourceCategoryLabel(r.category)}] ${r.title}`);
    }
    if (newResources.length > MAX_RESOURCES) lines.push(`  …κι άλλα ${newResources.length - MAX_RESOURCES} / +${newResources.length - MAX_RESOURCES} more`);
    lines.push(`👉 ${SITE}/resources`);
  }

  if (newMembers.length) {
    lines.push('', `👋 Νέα μέλη / New members (${newMembers.length})`);
    for (const m of newMembers.slice(0, MAX_MEMBERS)) lines.push(`• ${m.display_name}`);
    if (newMembers.length > MAX_MEMBERS) lines.push(`  …κι άλλα ${newMembers.length - MAX_MEMBERS} / +${newMembers.length - MAX_MEMBERS} more`);
    lines.push(`👉 ${SITE}/members`);
  }

  lines.push('', '—', 'Δείτε τα όλα στον χάρτη / See everything on the map:', SITE);

  return {
    send,
    weekStart: nowISO.slice(0, 10),
    text: lines.join('\n'),
    counts,
  };
}
