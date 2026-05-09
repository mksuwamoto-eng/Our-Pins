import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MembersPage() {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('members');
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path, display_pref')
    .eq('is_member', true)
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl">{t('title')}</h1>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {(members ?? []).map((m) => (
            <li key={m.id}>
              <Link href={`/members/${m.id}`} className="card flex flex-col items-center gap-2 p-3">
                <div className="h-14 w-14 rounded-full bg-[var(--color-washi-200)]" />
                <p className="text-sm">
                  {m.display_name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
