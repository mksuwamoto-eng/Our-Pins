import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { SignOutButton } from '@/components/settings/SignOutButton';

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const tAuth = await getTranslations('auth');

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
        <h1 className="font-serif text-2xl">{t('title')}</h1>
        <Link href="/settings/profile" className="card block p-4 hover:bg-[var(--surface-subtle)]">
          <h2 className="font-medium">{t('editProfile')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('editProfileHelp')}</p>
        </Link>
        <SignOutButton label={tAuth('signOut')} />
        <div className="card p-4">
          <h2 className="font-medium text-[var(--color-terracotta-500)]">{t('danger')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('deleteAccountConfirm')}</p>
          <Link href="/settings/danger" className="mt-2 inline-block text-sm underline">
            {t('deleteAccount')}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
