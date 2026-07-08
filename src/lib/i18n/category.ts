import type { useTranslations } from 'next-intl';

// Categories are seeded in the DB with English labels (supabase/seed.sql).
// The `categories` message namespace maps each slug → a localized label; fall
// back to the DB label for any slug not yet translated (e.g. a future category
// added by migration before its translations land).
type CategoryT = ReturnType<typeof useTranslations>;

export function categoryLabel(
  t: CategoryT,
  category: { slug: string; label: string },
): string {
  return t.has(category.slug) ? t(category.slug) : category.label;
}
