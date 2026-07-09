import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('admin');
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl">{t('title')}</h1>
        <nav className="mb-6 flex gap-3 border-b border-[var(--border)] pb-2 text-sm">
          <Link href="/admin/members">{t('members')}</Link>
          <Link href="/admin/invites">{t('invites')}</Link>
          <Link href="/admin/moderation">{t('moderation')}</Link>
          <Link href="/admin/line-groups">{t('lineGroups')}</Link>
          <Link href="/admin/feedback">{t('feedback')}</Link>
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
