import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!member) notFound();

  const { data: pins } = await supabase
    .from('pins')
    .select('id, name, address, category_id, prefecture')
    .eq('created_by', id)
    .is('archived_at', null);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-serif text-3xl">
          {member.display_pref === 'avatar_only' ? '—' : member.display_name}
        </h1>

        <h2 className="mt-6 font-serif text-xl">Pins</h2>
        <ul className="mt-2 space-y-2">
          {(pins ?? []).map((p) => (
            <li key={p.id} className="card p-3">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-[var(--muted)]">{p.address}</p>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
