import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('app');
  const tAdmin = await getTranslations('admin');
  const tSettings = await getTranslations('settings');

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
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Link href="/" className="font-serif text-xl">
          {t('name')}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/members">Members</Link>
          {userRole === 'admin' ? <Link href="/admin/members">{tAdmin('title')}</Link> : null}
          <Link href="/settings">{tSettings('title')}</Link>
          <LanguageToggle />
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
