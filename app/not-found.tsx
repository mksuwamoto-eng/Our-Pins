import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Rendered inside the root layout, so it inherits the theme (next-themes) and
// the cookie locale — unlike Next's default white/English not-found page.
export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="mb-3 font-serif text-3xl">{t('title')}</h1>
      <p className="mb-6 text-[var(--muted)]">{t('body')}</p>
      <Link
        href="/"
        className="mx-auto rounded-lg bg-[var(--primary)] px-4 py-2 font-medium text-white"
      >
        {t('back')}
      </Link>
    </main>
  );
}
