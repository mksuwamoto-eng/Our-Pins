import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileEditForm } from '@/components/settings/ProfileEditForm';

export default async function EditProfilePage() {
  const t = await getTranslations('settings');
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_path, instagram, website')
    .eq('id', user.id)
    .maybeSingle();

  let avatarUrl: string | null = null;
  if (profile?.avatar_path && !profile.avatar_path.includes('_pending')) {
    const { data } = await supabase.storage
      .from('pin-photos')
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
        <h1 className="font-serif text-2xl">{t('editProfile')}</h1>
        <ProfileEditForm
          userId={user.id}
          initial={{
            displayName: profile?.display_name ?? '',
            instagram: profile?.instagram ?? '',
            website: profile?.website ?? '',
            avatarPath: profile?.avatar_path ?? '',
            avatarUrl,
          }}
        />
      </div>
    </AppShell>
  );
}
