'use client';

import { Drawer } from 'vaul';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeVouches } from '@/lib/supabase/realtime';
import type { Category, Pin, Vouch, Profile } from '@/lib/supabase/types';
import { VouchButton } from '@/components/pins/VouchButton';

interface Props {
  pin: Pin | null;
  category: Category | null;
  onClose: () => void;
}

export function PinSheet({ pin, category, onClose }: Props) {
  const t = useTranslations('pin');
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [vouchers, setVouchers] = useState<Map<string, Profile>>(new Map());

  useRealtimeVouches(pin?.id ?? null);

  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('vouches')
      .select('*')
      .eq('pin_id', pin.id)
      .then(async ({ data }) => {
        if (cancelled || !data) return;
        setVouches(data as Vouch[]);
        const ids = Array.from(new Set(data.map((v) => v.voucher_id)));
        if (!ids.length) return;
        const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
        if (cancelled || !profs) return;
        const map = new Map<string, Profile>();
        for (const p of profs) map.set(p.id, p as Profile);
        setVouchers(map);
      });
    return () => {
      cancelled = true;
    };
  }, [pin?.id]);

  return (
    <Drawer.Root open={!!pin} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-30 bg-black/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-[var(--surface)] p-6 outline-none">
          <Drawer.Title className="font-serif text-2xl">{pin?.name}</Drawer.Title>
          {category ? (
            <span className="mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-xs" style={{ background: category.color, color: 'white' }}>
              {category.label}
            </span>
          ) : null}
          <p className="mt-2 text-sm text-[var(--muted)]">{pin?.address}</p>
          <p className="mt-4 whitespace-pre-wrap">{pin?.vouch_note}</p>

          {pin ? <VouchButton pinId={pin.id} /> : null}

          <h3 className="mt-6 text-sm font-medium">{t('vouchedBy')} ({vouches.length})</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {vouches.map((v) => {
              const p = vouchers.get(v.voucher_id);
              return (
                <li key={v.id} className="flex items-center gap-1 rounded-full bg-[var(--color-washi-100)] px-2 py-1 text-xs">
                  <span>{p?.display_pref === 'avatar_only' ? '•' : p?.display_name ?? t('former')}</span>
                </li>
              );
            })}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
