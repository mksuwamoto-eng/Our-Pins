import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('app');
  const tAdmin = await getTranslations('admin');
  const tSettings = await getTranslations('settings');
  const tActivity = await getTranslations('activity');
  const tMembers = await getTranslations('members');
  const tBoard = await getTranslations('board');

  const { COMMUNITY_FILES_URL } = getServerEnv();

  const supabase = await createSupabaseServerClient();
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  let userRole = 'member';
  if (accessToken) {
    const [, body] = accessToken.split('.');
    if (body) {
      try {
        const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
        if (typeof claims.user_role === 'string') userRole = claims.user_role;
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-serif text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/goj-logo.png" alt="" className="h-8 w-8 rounded-md" />
          <span className="hidden min-[440px]:inline">{t('name')}</span>
        </Link>
        {/* Scrolls horizontally on narrow screens instead of wrapping/cramping. */}
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href="/activity" className="shrink-0">{tActivity('title')}</Link>
          <Link href="/board" className="shrink-0">{tBoard('navTitle')}</Link>
          <Link href="/members" className="shrink-0">{tMembers('title')}</Link>
          {COMMUNITY_FILES_URL ? (
            <a
              href={COMMUNITY_FILES_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={t('filesTooltip')}
              className="shrink-0"
            >
              {t('files')} <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          {userRole === 'admin' ? (
            <Link href="/admin/members" className="shrink-0">{tAdmin('title')}</Link>
          ) : null}
          <Link href="/settings" className="shrink-0">{tSettings('title')}</Link>
          <span className="flex shrink-0 items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </span>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
