import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { i18nConfig, LOCALE_COOKIE, type Locale } from '../../i18n.config';

function pickLocale(value: string | undefined): Locale {
  return (i18nConfig.locales as readonly string[]).includes(value ?? '')
    ? (value as Locale)
    : i18nConfig.defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const fromHeader = headerStore
    .get('accept-language')
    ?.split(',')[0]
    ?.split('-')[0];
  const locale = pickLocale(fromCookie ?? fromHeader);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
