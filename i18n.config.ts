/**
 * Forkable i18n config. A diaspora community cloning this repo edits this file
 * (defaultLocale + locales) and adds messages/<locale>.json.
 *
 * See README "Fork in 10 minutes" — step 6.
 */
export const i18nConfig = {
  defaultLocale: 'el' as const,
  locales: ['el', 'en'] as const,
};

export type Locale = (typeof i18nConfig.locales)[number];

export const LOCALE_COOKIE = 'NEXT_LOCALE';
