import { getTranslations } from 'next-intl/server';

// The policy content lives in the `privacy` message namespace (EN + EL) and is
// written to match what the code actually does — verified claim-by-claim in the
// August 2026 copy-vs-reality audit. If a feature changes what we collect or
// share, update BOTH locales and the lastUpdated line here.

export async function generateMetadata() {
  const t = await getTranslations('privacy');
  return { title: t('title') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacy');
  const collectBullets = ['collectSignIn', 'collectProfile', 'collectContent', 'collectParea', 'collectFeedback'] as const;
  const useBullets = ['useVerify', 'useShow', 'useManage'] as const;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 font-serif text-3xl text-[var(--fg)]">{t('title')}</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">{t('lastUpdated')}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--fg)]">
        <section>
          <h2 className="mb-2 font-serif text-xl">{t('whoTitle')}</h2>
          <p>{t('whoBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('collectTitle')}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {collectBullets.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('lineTitle')}</h2>
          <p>{t('lineBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('digestTitle')}</h2>
          <p>{t('digestBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('useTitle')}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {useBullets.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
          <p className="mt-2">{t('useNote')}</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('storeTitle')}</h2>
          <p>{t('storeBody')}</p>
          <p className="mt-2">{t('retentionBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">{t('choicesTitle')}</h2>
          <p>{t('choicesBody')}</p>
        </section>
      </div>
    </main>
  );
}
