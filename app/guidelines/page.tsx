import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';

interface Rule {
  title: string;
  body: string;
}

export default async function GuidelinesPage() {
  const t = await getTranslations('guidelines');
  const rules = t.raw('rules') as Rule[];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-serif text-2xl">{t('title')}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t('intro')}</p>
        <ol className="mt-6 space-y-5">
          {rules.map((rule, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-medium text-[var(--primary)]">
                {i + 1}
              </span>
              <div>
                <h2 className="font-medium">{rule.title}</h2>
                <p className="mt-0.5 text-sm text-[var(--fg)]">{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--muted)]">
          {t('closing')}
        </p>
      </div>
    </AppShell>
  );
}
