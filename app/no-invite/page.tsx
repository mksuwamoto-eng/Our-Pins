import { getTranslations } from 'next-intl/server';

export default async function NoInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const t = await getTranslations('auth');
  const reasonT = await getTranslations('invite');
  const params = await searchParams;
  const reason = params.reason;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="mb-3 font-serif text-3xl">{t('noInviteHeading')}</h1>
      <p className="mb-2 text-[var(--muted)]">{t('noInviteBody')}</p>
      {reason === 'expired' ? <p className="text-sm text-[var(--color-terracotta-500)]">{reasonT('expiredBody')}</p> : null}
      {reason === 'invalid' ? <p className="text-sm text-[var(--color-terracotta-500)]">{reasonT('invalidBody')}</p> : null}
    </main>
  );
}
