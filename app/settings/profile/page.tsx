import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileEditForm } from '@/components/settings/ProfileEditForm';

export default async function EditProfilePage() {
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

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
        <h1 className="font-serif text-2xl">Edit profile</h1>
        <ProfileEditForm
          userId={user.id}
          initial={{
            displayName: profile?.display_name ?? '',
            instagram: profile?.instagram ?? '',
            website: profile?.website ?? '',
            avatarPath: profile?.avatar_path ?? '',
          }}
        />
      </div>
    </AppShell>
  );
}
