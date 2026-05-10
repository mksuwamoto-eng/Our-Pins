import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { VouchPanel } from '@/components/pins/VouchPanel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function PinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: pin } = await supabase.from('pins').select('*').eq('id', id).maybeSingle();
  if (!pin) notFound();

  const { data: category } = await supabase.from('categories').select('*').eq('id', pin.category_id).maybeSingle();
  const { data: vouches } = await supabase.from('vouches').select('*, voucher:profiles(*)').eq('pin_id', id);

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/" className="text-sm text-[var(--muted)]">
          ← Back to map
        </Link>
        <h1 className="mt-2 font-serif text-3xl">{pin.name}</h1>
        {category ? (
          <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs text-white" style={{ background: category.color }}>
            {category.label}
          </span>
        ) : null}
        <p className="mt-2 text-sm text-[var(--muted)]">{pin.address}</p>
        <p className="mt-4 whitespace-pre-wrap">{pin.vouch_note}</p>

        <VouchPanel pinId={pin.id} />

        <h2 className="mt-8 font-serif text-xl">Vouched by</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(vouches ?? []).map((v) => {
            const p = (v as unknown as { voucher: { display_name: string; display_pref: string } | null }).voucher;
            return (
              <li key={v.id} className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-sm">
                {p?.display_name ?? 'Former member'}
              </li>
            );
          })}
        </ul>
      </article>
    </AppShell>
  );
}
