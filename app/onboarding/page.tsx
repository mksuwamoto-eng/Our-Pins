import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profile?.is_member) redirect('/');

  const t = await getTranslations('onboarding');

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 font-serif text-3xl">{t('title')}</h1>
      <OnboardingForm
        userId={user.id}
        initial={{
          displayName: profile?.display_name ?? '',
          displayPref: profile?.display_pref ?? 'avatar_name',
          instagram: profile?.instagram ?? '',
          website: profile?.website ?? '',
        }}
      />
    </main>
  );
}
