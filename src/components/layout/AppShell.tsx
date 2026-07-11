import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import { HelpMenu } from './HelpMenu';

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('app');
  const tAdmin = await getTranslations('admin');
  const tSettings = await getTranslations('settings');
  const tActivity = await getTranslations('activity');
  const tMembers = await getTranslations('members');
  const tBoard = await getTranslations('board');
  const tResources = await getTranslations('resources');

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
        <Link
          href="/"
          aria-label={t('name')}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-serif text-xl"
        >
          <Image
            src="/icons/goj-logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-md"
          />
          <span className="hidden min-[440px]:inline">{t('name')}</span>
        </Link>
        {/* Desktop inline nav. On phones this is hidden and the burger (in the
            controls cluster) takes over — see MobileNav. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-3 whitespace-nowrap text-sm md:flex">
          <Link href="/activity" className="shrink-0">{tActivity('title')}</Link>
          <Link href="/board" className="shrink-0">{tBoard('navTitle')}</Link>
          <Link href="/resources" className="shrink-0">{tResources('navTitle')}</Link>
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
        </nav>
        {/* Always-visible controls, pinned to the right edge. The burger only
            renders on phones (md:hidden); Help/language/theme are always on. */}
        <span className="flex shrink-0 items-center gap-3 border-l border-[var(--border)] pl-3">
          <MobileNav filesUrl={COMMUNITY_FILES_URL ?? null} isAdmin={userRole === 'admin'} />
          <HelpMenu />
          <LanguageToggle />
          <ThemeToggle />
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
