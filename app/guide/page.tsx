import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';

interface Section {
  title: string;
  body: string;
}

export default async function GuidePage() {
  const t = await getTranslations('guide');
  const sections = t.raw('sections') as Section[];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-serif text-2xl">{t('title')}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t('intro')}</p>
        <div className="mt-6 space-y-5">
          {sections.map((section, i) => (
            <div key={i}>
              <h2 className="font-medium">{section.title}</h2>
              <p className="mt-0.5 text-sm text-[var(--fg)]">{section.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm">
          <Link href="/guidelines" className="text-[var(--primary)] underline">
            {t('guidelinesLink')}
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
