'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Translations } from '@/lib/supabase/types';

/**
 * Member-written text shown in the reader's language. When a stored
 * translation differs from the original, it renders the translation with a
 * small tag that toggles back to the author's own words.
 */
export function LocalizedText({
  original,
  translations,
  className,
}: {
  original: string;
  translations: Translations;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('pin');
  const [showOriginal, setShowOriginal] = useState(false);

  const localized = translations?.[locale === 'el' ? 'el' : 'en'];
  const isTranslated = !!localized && localized.trim() !== original.trim();
  const text = isTranslated && !showOriginal ? localized : original;

  return (
    <p className={className}>
      {text}
      {isTranslated ? (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="ml-1.5 align-baseline text-xs italic text-[var(--muted)] underline decoration-dotted"
        >
          {showOriginal ? t('showTranslation') : t('translated')}
        </button>
      ) : null}
    </p>
  );
}
