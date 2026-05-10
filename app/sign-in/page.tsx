import { getTranslations } from 'next-intl/server';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const t = await getTranslations('auth');
  const params = await searchParams;
  const next = encodeURIComponent(params.next ?? '/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/goj-logo.png"
        alt=""
        className="mb-6 h-20 w-20 self-center rounded-2xl shadow-sm"
      />
      <h1 className="mb-2 text-center font-serif text-3xl text-[var(--fg)]">{t('signInTitle')}</h1>
      <p className="mb-8 text-center text-sm text-[var(--muted)]">{t('needInvite')}</p>

      <div className="card flex flex-col gap-3 p-6">
        <a
          href={`/api/auth/line/start?next=${next}`}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-medium text-white transition hover:bg-[#05B14B]"
        >
          {t('signInWithLine')}
        </a>
        <a
          href={`/api/auth/google/start?next=${next}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--fg)] transition hover:bg-[var(--color-washi-100)]"
        >
          {t('signInWithGoogle')}
        </a>
      </div>

      {params.error ? (
        <p className="mt-6 text-sm text-[var(--color-terracotta-500)]">{params.error}</p>
      ) : null}
    </main>
  );
}
