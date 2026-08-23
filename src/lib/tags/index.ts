// The pin tag vocabulary — a second axis, orthogonal to category. Category
// answers "what kind of place"; a tag answers "why it matters to a Greek in
// Japan". A Greek taverna is Restaurants + `greek`; a Greek-speaking lawyer is
// Lawyers & immigration + `greek-speaking`.
//
// Frozen, like categories: no admin CRUD, a migration to change. Deliberately
// tiny — an unused tag is worse than a missing one, because it trains people to
// skip the picker.
//
// !! Must stay in sync with the pins_tags_vocab CHECK in migration 0034, which
// !! is the source of truth. A slug here that the DB rejects surfaces as a
// !! 23514 on save; a slug there that is missing here is simply unreachable.
export const TAG_SLUGS = ['greek', 'greek-speaking', 'english-ok'] as const;

export type TagSlug = (typeof TAG_SLUGS)[number];

export const MAX_TAGS_PER_PIN = TAG_SLUGS.length;

export function isTagSlug(v: string): v is TagSlug {
  return (TAG_SLUGS as readonly string[]).includes(v);
}

/**
 * English labels for the Parea corpus only. The UI reads its labels from
 * next-intl (`tags` namespace, EL/EN); the corpus is a single English prompt
 * with no locale, so it can't use those. Kept beside the vocabulary so a new
 * slug can't be added without a label for both.
 */
export const TAG_CORPUS_LABELS: Record<TagSlug, string> = {
  greek: 'Greek (Greek-owned, Greek food, or Greek products)',
  'greek-speaking': 'Greek spoken here',
  'english-ok': 'English-speaking service',
};
