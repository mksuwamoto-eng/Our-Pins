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

  // The LINE photo is imported automatically at sign-in (ensureLineAvatar), so
  // by the time onboarding renders there is usually already an avatar to show.
  // Sign it, or the member sees an empty camera circle and assumes nothing
  // happened.
  const hasAvatar = Boolean(profile?.avatar_path && !profile.avatar_path.includes('_pending'));
  let avatarUrl: string | null = null;
  if (hasAvatar && profile?.avatar_path) {
    const { data } = await supabase.storage
      .from('pin-photos')
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  // Only offer the manual "Use my LINE photo" button when the automatic import
  // did not produce one — otherwise it invites a click that changes nothing.
  const linePicture =
    !hasAvatar && typeof user.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : null;

  // Pre-fill from the LINE display name where we can — most Greek LINE users
  // have "First Last" set, which makes the name step a confirmation instead of
  // typing. Anything past the first space is the surname.
  const lineName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '';
  const [lineFirst = '', ...lineRest] = lineName.trim().split(/\s+/);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-2 font-serif text-3xl">{t('title')}</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">{t('subtitle')}</p>
      <OnboardingForm
        userId={user.id}
        linePicture={linePicture}
        avatarUrl={avatarUrl}
        initial={{
          firstName: lineFirst,
          lastName: lineRest.join(' '),
          instagram: profile?.instagram ?? '',
          website: profile?.website ?? '',
          linkedin: profile?.linkedin ?? '',
          bio: profile?.bio ?? '',
        }}
      />
    </main>
  );
}
