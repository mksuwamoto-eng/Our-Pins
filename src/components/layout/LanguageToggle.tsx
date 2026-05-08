'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LOCALE_COOKIE, type Locale } from '../../../i18n.config';

export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const next: Locale = locale === 'el' ? 'en' : 'el';

  function handleClick() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <button onClick={handleClick} className="rounded px-2 py-1 text-xs uppercase">
      {next}
    </button>
  );
}
