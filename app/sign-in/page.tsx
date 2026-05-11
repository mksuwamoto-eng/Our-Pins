import { getTranslations } from 'next-intl/server';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { publicEnv } from '@/lib/env';

// Supabase error messages vary by version (e.g. "Token has expired",
// "invalid_grant", "Email link is invalid or has expired"); match loosely
// so the common case still gets the friendly copy.
function classifyAuthError(raw: string): 'expired' | 'generic' {
  const s = raw.toLowerCase();
  if (s.includes('expire') || s.includes('invalid') || s.includes('code') || s.includes('otp') || s.includes('token')) {
    return 'expired';
  }
  return 'generic';
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const t = await getTranslations('auth');
  const params = await searchParams;
  const nextParam = params.next ?? '/';
  const nextEncoded = encodeURIComponent(nextParam);
  const friendlyError = params.error
    ? t(classifyAuthError(params.error) === 'expired' ? 'linkExpired' : 'signInError')
    : null;

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

      {friendlyError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--fg)]"
        >
          {friendlyError}
        </div>
      ) : null}

      <div className="card flex flex-col gap-3 p-6">
        <MagicLinkForm siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL} next={nextParam} />

        <div className="my-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--border)]" />
          or
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <a
          href={`/api/auth/line/start?next=${nextEncoded}`}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-medium text-white transition hover:bg-[#05B14B]"
        >
          {t('signInWithLine')}
        </a>
        <a
          href={`/api/auth/google/start?next=${nextEncoded}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--fg)] transition hover:bg-[var(--surface-subtle)]"
        >
          {t('signInWithGoogle')}
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        We use sign-in only to verify it&apos;s you. We never read your inbox or contacts. Your
        email is visible only to community admins.
      </p>
    </main>
  );
}
