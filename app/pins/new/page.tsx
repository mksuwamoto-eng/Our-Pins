import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { PinForm } from '@/components/pins/PinForm';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export default async function NewPinPage() {
  const t = await getTranslations('map');
  // Categories are global config; fetch with the admin client to bypass RLS.
  const admin = createSupabaseAdminClient();
  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .is('archived_at', null)
    .order('sort_order');

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl">{t('addPin')}</h1>
        <PinForm categories={categories ?? []} />
      </div>
    </AppShell>
  );
}
