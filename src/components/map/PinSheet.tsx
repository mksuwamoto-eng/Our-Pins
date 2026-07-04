'use client';

import { Drawer } from 'vaul';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Pencil, Share2, X } from 'lucide-react';
import { getMapsLoader } from '@/lib/maps/loader';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeVouches } from '@/lib/supabase/realtime';
import type { Category, Pin, Vouch, Profile } from '@/lib/supabase/types';
import { relativeTime } from '@/lib/time';
import { VouchPanel } from '@/components/pins/VouchPanel';
import { InlineAddPinForm } from '@/components/pins/InlineAddPinForm';
import { PinEditForm } from '@/components/pins/PinEditForm';
import { PlaceInfoCard, type PlaceDetails } from './PlaceInfoCard';

export type SheetSelection =
  | { kind: 'pin'; pin: Pin }
  | { kind: 'place'; placeId: string; location: { lat: number; lng: number } | null }
  | null;

interface Props {
  selection: SheetSelection;
  categories: Category[];
  onClose: () => void;
  onPinSaved: (pin: Pin) => void;
  onPinDeleted?: (pinId: string) => void;
  onPinUpdated?: (pin: Pin) => void;
}

export function PinSheet({
  selection,
  categories,
  onClose,
  onPinSaved,
  onPinDeleted,
  onPinUpdated,
}: Props) {
  const tCommon = useTranslations('common');
  const open = selection !== null;
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-30 bg-black/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-6 outline-none">
          {selection?.kind === 'pin' ? <ShareButton pinId={selection.pin.id} /> : null}
          <Drawer.Close
            aria-label={tCommon('close')}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <X className="h-5 w-5" />
          </Drawer.Close>
          {selection?.kind === 'pin' ? (
            <ExistingPinView
              pin={selection.pin}
              categories={categories}
              onDeleted={(pinId) => {
                onPinDeleted?.(pinId);
                onClose();
              }}
              onUpdated={(p) => onPinUpdated?.(p)}
            />
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

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const google = await getMapsLoader().load();
    const place = new google.maps.places.Place({ id: placeId });
    await place.fetchFields({
      fields: [
        'displayName',
        'formattedAddress',
        'location',
        'addressComponents',
        'photos',
        'regularOpeningHours',
        'nationalPhoneNumber',
        'internationalPhoneNumber',
        'websiteURI',
        'googleMapsURI',
        'editorialSummary',
        'primaryType',
      ],
    });

    const photoUrls = (place.photos ?? [])
      .slice(0, 5)
      .map((p) => {
        try {
          return p.getURI({ maxHeight: 240, maxWidth: 360 });
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u);

    return {
      placeId,
      name: place.displayName ?? 'Unknown place',
      address: place.formattedAddress ?? '',
      location: place.location
        ? { lat: place.location.lat(), lng: place.location.lng() }
        : { lat: 0, lng: 0 },
      addressComponents: (place.addressComponents ?? []).map((c) => ({
        longText: c.longText ?? '',
        shortText: c.shortText ?? '',
        types: c.types ?? [],
      })),
      photoUrls,
      weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions ?? [],
      phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
      websiteUri: place.websiteURI ?? null,
      googleMapsUri: place.googleMapsURI ?? null,
      editorialSummary:
        typeof place.editorialSummary === 'string' ? place.editorialSummary : null,
      primaryType: place.primaryType ?? null,
    };
  } catch {
    return null;
  }
}

function ExistingPinView({
  pin,
  categories,
  onDeleted,
  onUpdated,
}: {
  pin: Pin;
  categories: Category[];
  onDeleted?: (pinId: string) => void;
  onUpdated?: (pin: Pin) => void;
}) {
  const t = useTranslations('pin');
  const category = categories.find((c) => c.id === pin.category_id) ?? null;
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [vouchers, setVouchers] = useState<Map<string, Profile>>(new Map());
  const [editing, setEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtimeVouches(pin.id);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string }; access_token: string } | null } }) => {
      setCurrentUserId(data.session?.user.id ?? null);
      const token = data.session?.access_token;
      if (token) {
        const [, body] = token.split('.');
        if (body) {
          try {
            const padded = body.replace(/-/g, '+').replace(/_/g, '/');
            const claims = JSON.parse(
              atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '=')),
            ) as Record<string, unknown>;
            if (typeof claims.user_role === 'string') setCurrentUserRole(claims.user_role);
          } catch {
            // ignore
          }
        }
      }
    });
  }, []);

  const canEdit = currentUserId === pin.created_by || currentUserRole === 'admin';

  useEffect(() => {
    if (!pin.google_place_id) return;
    let cancelled = false;
    fetchPlaceDetails(pin.google_place_id).then((d) => {
      if (!cancelled) setPlaceDetails(d);
    });
    return () => {
      cancelled = true;
    };
  }, [pin.google_place_id]);

  const [avatarUrls, setAvatarUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('vouches')
      .select('*')
      .eq('pin_id', pin.id)
      .order('created_at', { ascending: false })
      .then(async ({ data }: { data: Vouch[] | null }) => {
        if (cancelled || !data) return;
        setVouches(data);
        const ids = Array.from(new Set(data.map((v) => v.voucher_id)));
        if (!ids.length) return;
        const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
        if (cancelled || !profs) return;
        const profiles = profs as Profile[];
        const map = new Map<string, Profile>();
        for (const p of profiles) map.set(p.id, p);
        setVouchers(map);

        const paths = profiles
          .map((p) => p.avatar_path)
          .filter((p): p is string => typeof p === 'string' && !p.includes('_pending'));
        if (!paths.length) return;
        const { data: signed } = await supabase.storage
          .from('pin-photos')
          .createSignedUrls(paths, 3600);
        if (cancelled || !signed) return;
        const urlMap = new Map<string, string>();
        for (const s of signed) {
          if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
        }
        setAvatarUrls(urlMap);
      });
    return () => {
      cancelled = true;
    };
  }, [pin.id, refreshKey]);

  const otherVouches = vouches.filter((v) => v.voucher_id !== pin.created_by);

  if (editing) {
    return (
      <>
        <Drawer.Title className="font-serif text-2xl">{t('editPin')}</Drawer.Title>
        <p className="mt-1 text-sm text-[var(--muted)]">{pin.name}</p>
        <div className="mt-4">
          <PinEditForm
            pin={pin}
            categories={categories}
            onSaved={(updated) => {
              setEditing(false);
              onUpdated?.(updated);
            }}
            onCancel={() => setEditing(false)}
            onDeleted={() => {
              setEditing(false);
              onDeleted?.(pin.id);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Drawer.Title className="font-serif text-2xl">{pin.name}</Drawer.Title>
        {canEdit ? (
          <button
            onClick={() => setEditing(true)}
            aria-label={t('editPin')}
            className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-xs"
          >
            <Pencil className="h-3 w-3" />
            {t('edit')}
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {category ? (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs"
            style={{ background: category.color, color: 'white' }}
          >
            {category.label}
          </span>
        ) : null}
        <span className="text-sm text-[var(--muted)]">{pin.address}</span>
      </div>

      {placeDetails ? (
        <div className="mt-4">
          <PlaceInfoCard place={placeDetails} />
        </div>
      ) : null}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-medium">
          {t('vouchedBy')} ({vouches.length})
        </h3>

        <div className="mt-3 rounded-lg bg-[var(--surface-subtle)] p-3">
          <div className="flex items-start gap-3">
            <Link href={`/members/${pin.created_by}`} className="shrink-0">
              {(() => {
                const creator = vouchers.get(pin.created_by);
                const url = creator?.avatar_path ? avatarUrls.get(creator.avatar_path) : undefined;
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="h-9 w-9 rounded-full bg-[var(--color-washi-200)]"
                    aria-hidden
                  />
                );
              })()}
            </Link>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  <Link href={`/members/${pin.created_by}`} className="text-inherit hover:underline">
                    {labelFor(vouchers.get(pin.created_by)) ?? t('former')}
                  </Link>{' '}
                  <span className="text-xs font-normal text-[var(--muted)]">— {t('pinned')}</span>
                </span>
                <time className="text-xs text-[var(--muted)]">{relativeTime(pin.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{pin.vouch_note}</p>
            </div>
          </div>
        </div>

        <ul className="mt-3 space-y-3">
          {otherVouches.map((v) => {
            const p = vouchers.get(v.voucher_id);
            const url = p?.avatar_path ? avatarUrls.get(p.avatar_path) : undefined;
            return (
              <li key={v.id} className="flex gap-3">
                <Link href={`/members/${v.voucher_id}`} className="shrink-0">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-full bg-[var(--color-washi-200)]"
                      aria-hidden
                    />
                  )}
                </Link>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      <Link href={`/members/${v.voucher_id}`} className="text-inherit hover:underline">
                        {labelFor(p) ?? t('former')}
                      </Link>
                    </span>
                    <time className="text-xs text-[var(--muted)]">
                      {relativeTime(v.created_at)}
                    </time>
                  </div>
                  {v.comment ? (
                    <p className="mt-1 text-sm">{v.comment}</p>
                  ) : (
                    <p className="mt-1 text-xs italic text-[var(--muted)]">
                      {t('vouchedNoComment')}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <VouchPanel pinId={pin.id} onChange={() => setRefreshKey((k) => k + 1)} />
      </div>
    </>
  );
}

function labelFor(p: Profile | undefined): string | null {
  return p ? p.display_name : null;
}

function ShareButton({ pinId }: { pinId: string }) {
  const t = useTranslations('pin');
  const [copied, setCopied] = useState(false);
  async function handleShare() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/pins/${pinId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (insecure context, permission denied) — silent.
    }
  }
  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={t('shareLink')}
      className="absolute right-14 top-3 z-10 flex h-8 items-center gap-1 rounded-full px-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          <span className="pr-1">{t('copied')}</span>
        </>
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </button>
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
  const tPin = useTranslations('pin');
  const tCommon = useTranslations('common');
  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingPin, setExistingPin] = useState<Pin | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExistingPin(null);
    setPlace(null);

    fetch(`/api/pins/by-place/${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((found: Pin | null) => {
        if (cancelled) return;
        if (found) setExistingPin(found);
      })
      .catch(() => {});

    fetchPlaceDetails(placeId).then((d) => {
      if (cancelled) return;
      setPlace(d);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (loading) {
    return (
      <>
        <Drawer.Title className="font-serif text-xl">{tCommon('loading')}</Drawer.Title>
        <p className="mt-4 text-sm text-[var(--muted)]">{tPin('fetchingPlace')}</p>
      </>
    );
  }

  if (existingPin) {
    return <ExistingPinView pin={existingPin} categories={categories} />;
  }

  // fetchPlaceDetails resolved null — Google lookup failed. Without this
  // branch the sheet shows "Loading…" forever.
  if (!place) {
    return (
      <>
        <Drawer.Title className="font-serif text-xl">{tPin('placeErrorTitle')}</Drawer.Title>
        <p className="mt-4 text-sm text-[var(--muted)]">{tPin('placeErrorBody')}</p>
      </>
    );
  }

  return (
    <>
      <Drawer.Title className="font-serif text-2xl">{place.name}</Drawer.Title>
      <p className="mt-1 text-sm text-[var(--muted)]">{place.address}</p>
      <div className="mt-4">
        <PlaceInfoCard place={place} />
      </div>
      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <p className="text-sm">
          {tPin('firstVouchPrompt')} <strong>{tPin('beTheFirst')}</strong>
        </p>
        <InlineAddPinForm place={place} categories={categories} onSaved={onSaved} />
      </div>
    </>
  );
}
