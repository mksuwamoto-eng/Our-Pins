import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: pins } = await supabase
    .from('pins')
    .select('id, name, address, category_id, prefecture')
    .eq('created_by', id)
    .is('archived_at', null);

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

        <h2 className="mt-6 font-serif text-xl">Pins</h2>
        {pins && pins.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {pins.map((p) => (
              <li key={p.id} className="card p-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-[var(--muted)]">{p.address}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {member.display_name} hasn&apos;t pinned anything yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
