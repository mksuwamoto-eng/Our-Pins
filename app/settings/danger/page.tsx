import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { DeleteAccountForm } from '@/components/settings/DeleteAccountForm';

export default async function DangerPage() {
  const t = await getTranslations('settings');
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="font-serif text-2xl">{t('deleteAccount')}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('deleteAccountExplainer')}</p>
        <DeleteAccountForm />
      </div>
    </AppShell>
  );
}
