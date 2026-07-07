import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('members');
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!member) notFound();

  let avatarUrl: string | null = null;
  if (member.avatar_path && !member.avatar_path.includes('_pending')) {
    const { data } = await supabase.storage
      .from('pin-photos')
      .createSignedUrl(member.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  const [{ data: pins }, { count: vouchCount }] = await Promise.all([
    supabase
      .from('pins')
      .select('id, name, address, category_id, prefecture')
      .eq('created_by', id)
      .is('archived_at', null),
    // !inner + archived filter: vouches on archived pins would inflate the
    // count relative to the visible pin list below.
    supabase
      .from('vouches')
      .select('id, pins!inner(id)', { count: 'exact', head: true })
      .eq('voucher_id', id)
      .is('pins.archived_at', null),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[var(--color-washi-200)]" />
          )}
          <div>
            <h1 className="font-serif text-3xl">{member.display_name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t('pinsCount', { count: pins?.length ?? 0 })} ·{' '}
              {t('vouchesCount', { count: vouchCount ?? 0 })}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {member.instagram ? (
                <a
                  href={`https://instagram.com/${member.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  @{member.instagram}
                </a>
              ) : null}
              {member.website ? (
                <a
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {member.website.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {member.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--fg)]">{member.bio}</p>
        ) : null}

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="font-serif text-xl">{t('pinsHeading')}</h2>
          {pins && pins.length > 0 ? (
            <Link
              href={`/?author=${member.id}`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              {t('viewOnMap')}
            </Link>
          ) : null}
        </div>
        {pins && pins.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {pins.map((p) => (
              <li key={p.id}>
                <Link href={`/?pin=${p.id}`} className="card block p-3 hover:bg-[var(--surface-subtle)]">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-[var(--muted)]">{p.address}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t('noPinsYet', { name: member.display_name })}
          </p>
        )}
      </div>
    </AppShell>
  );
}
