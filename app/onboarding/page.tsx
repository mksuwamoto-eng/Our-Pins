import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profile?.onboarded_at) redirect('/');

  const t = await getTranslations('onboarding');

  // LINE sign-ins carry the LINE profile photo in user_metadata (session.ts).
  // It is imported automatically at sign-in (ensureLineAvatar); this still
  // backs a manual "Use my LINE photo" button for anyone who clears it.
  const linePicture =
    typeof user.user_metadata?.picture === 'string' ? user.user_metadata.picture : null;

  // Pre-fill from the LINE display name where we can — most Greek LINE users
  // have "First Last" set, which makes the name step a confirmation instead of
  // typing. Anything past the first space is the surname.
  const lineName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '';
  const [lineFirst = '', ...lineRest] = lineName.trim().split(/\s+/);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 font-serif text-3xl">{t('title')}</h1>
      <OnboardingForm
        userId={user.id}
        linePicture={linePicture}
        initial={{
          firstName: lineFirst,
          lastName: lineRest.join(' '),
          displayPref: profile?.display_pref ?? 'avatar_name',
          instagram: profile?.instagram ?? '',
          website: profile?.website ?? '',
        }}
      />
    </main>
  );
}
