'use client';

import { Drawer } from 'vaul';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getMapsLoader } from '@/lib/maps/loader';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeVouches } from '@/lib/supabase/realtime';
import type { Category, Pin, Vouch, Profile } from '@/lib/supabase/types';
import { relativeTime } from '@/lib/time';
import { VouchPanel } from '@/components/pins/VouchPanel';
import { InlineAddPinForm } from '@/components/pins/InlineAddPinForm';

export type SheetSelection =
  | { kind: 'pin'; pin: Pin }
  | { kind: 'place'; placeId: string; location: { lat: number; lng: number } | null }
  | null;

interface Props {
  selection: SheetSelection;
  categories: Category[];
  onClose: () => void;
  onPinSaved: (pin: Pin) => void;
}

interface FetchedPlace {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  addressComponents: Array<{ longText: string; shortText: string; types: string[] }>;
}

export function PinSheet({ selection, categories, onClose, onPinSaved }: Props) {
  const open = selection !== null;
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-30 bg-black/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-6 outline-none">
          {selection?.kind === 'pin' ? (
            <ExistingPinView pin={selection.pin} categories={categories} />
          ) : null}
          {selection?.kind === 'place' ? (
            <NewPlaceView
              placeId={selection.placeId}
              categories={categories}
              onSaved={onPinSaved}
            />
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ExistingPinView({ pin, categories }: { pin: Pin; categories: Category[] }) {
  const t = useTranslations('pin');
  const category = categories.find((c) => c.id === pin.category_id) ?? null;
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [vouchers, setVouchers] = useState<Map<string, Profile>>(new Map());

  useRealtimeVouches(pin.id);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('vouches')
      .select('*')
      .eq('pin_id', pin.id)
      .order('created_at', { ascending: false })
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
  }, [pin.id]);

  return (
    <>
      <Drawer.Title className="font-serif text-2xl">{pin.name}</Drawer.Title>
      {category ? (
        <span
          className="mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-xs"
          style={{ background: category.color, color: 'white' }}
        >
          {category.label}
        </span>
      ) : null}
      <p className="mt-2 text-sm text-[var(--muted)]">{pin.address}</p>
      <p className="mt-4 whitespace-pre-wrap">{pin.vouch_note}</p>

      <VouchPanel pinId={pin.id} />

      <h3 className="mt-6 text-sm font-medium">
        {t('vouchedBy')} ({vouches.length})
      </h3>
      <ul className="mt-3 space-y-3">
        {vouches.map((v) => {
          const p = vouchers.get(v.voucher_id);
          const name = p?.display_pref === 'avatar_only' ? '—' : p?.display_name ?? t('former');
          return (
            <li key={v.id} className="flex gap-3">
              <div
                className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-washi-200)]"
                aria-hidden
              />
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  <time className="text-xs text-[var(--muted)]">{relativeTime(v.created_at)}</time>
                </div>
                {v.comment ? (
                  <p className="mt-1 text-sm text-[var(--fg)]">{v.comment}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function NewPlaceView({
  placeId,
  categories,
  onSaved,
}: {
  placeId: string;
  categories: Category[];
  onSaved: (pin: Pin) => void;
}) {
  const [place, setPlace] = useState<FetchedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingPin, setExistingPin] = useState<Pin | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExistingPin(null);
    setPlace(null);

    // First check if this place is already a pin in our DB.
    fetch(`/api/pins/by-place/${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((found: Pin | null) => {
        if (cancelled) return;
        if (found) setExistingPin(found);
      })
      .catch(() => {});

    // In parallel, fetch Google Places details for the summary card.
    getMapsLoader()
      .load()
      .then(async (google) => {
        if (cancelled) return;
        const p = new google.maps.places.Place({ id: placeId });
        await p.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        });
        if (cancelled) return;
        setPlace({
          placeId,
          name: p.displayName ?? 'Unknown place',
          address: p.formattedAddress ?? '',
          location: p.location
            ? { lat: p.location.lat(), lng: p.location.lng() }
            : { lat: 0, lng: 0 },
          addressComponents: (p.addressComponents ?? []).map((c) => ({
            longText: c.longText ?? '',
            shortText: c.shortText ?? '',
            types: c.types ?? [],
          })),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (loading || !place) {
    return (
      <>
        <Drawer.Title className="font-serif text-xl">Loading…</Drawer.Title>
        <p className="mt-4 text-sm text-[var(--muted)]">Fetching place from Google.</p>
      </>
    );
  }

  // If somebody else already pinned this place between the time the map loaded
  // and now, switch to the existing-pin view.
  if (existingPin) {
    return <ExistingPinView pin={existingPin} categories={categories} />;
  }

  return (
    <>
      <Drawer.Title className="font-serif text-2xl">{place.name}</Drawer.Title>
      <p className="mt-1 text-sm text-[var(--muted)]">{place.address}</p>
      <p className="mt-4 text-sm">
        Nobody from the community has vouched for this place yet. <strong>Be the first.</strong>
      </p>
      <InlineAddPinForm place={place} categories={categories} onSaved={onSaved} />
    </>
  );
}
