'use client';

import { Drawer } from 'vaul';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Pencil, Share2, X } from 'lucide-react';
import { getMapsLoader } from '@/lib/maps/loader';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeVouches } from '@/lib/supabase/realtime';
import type { Category, Pin, Vouch, Profile } from '@/lib/supabase/types';
import { relativeTime } from '@/lib/time';
import { categoryLabel } from '@/lib/i18n/category';
import { LocalizedText } from '@/components/i18n/LocalizedText';
import { VouchPanel } from '@/components/pins/VouchPanel';
import { PinPhotos } from '@/components/pins/PinPhotos';
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
        {/* Scroll lives on the inner wrapper, NOT on Drawer.Content. Vaul injects
            an opaque `::after` overscroll mask at `top:100%` of Drawer.Content;
            if Content is the scroll container, that mask lands mid-content (once
            the body is taller than the sheet) and paints over the submit button,
            making it invisible + unclickable. Keeping Content non-scrolling
            parks the mask below the content where it belongs. The absolute
            buttons stay pinned to Content so they don't scroll away. */}
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col rounded-t-2xl bg-[var(--surface)] outline-none">
          {selection?.kind === 'pin' ? <ShareButton pinId={selection.pin.id} /> : null}
          <Drawer.Close
            aria-label={tCommon('close')}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <X className="h-5 w-5" />
          </Drawer.Close>
          <div className="min-h-0 overflow-y-auto p-6">
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
          </div>
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

// Stable empty defaults so cached queries return the same reference every
// render (keeps useMemo/effects from re-running on identity churn).
const EMPTY_VOUCHES: Vouch[] = [];
const EMPTY_VOUCHER_DATA: {
  vouchers: Map<string, Profile>;
  avatarUrls: Map<string, string>;
} = { vouchers: new Map(), avatarUrls: new Map() };

async function fetchVouches(pinId: string): Promise<Vouch[]> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from('vouches')
    .select('*')
    .eq('pin_id', pinId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Vouch[];
}

async function fetchVoucherProfiles(
  ids: string[],
): Promise<{ vouchers: Map<string, Profile>; avatarUrls: Map<string, string> }> {
  const supabase = getSupabaseBrowserClient();
  const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
  const profiles = (profs ?? []) as Profile[];
  const vouchers = new Map<string, Profile>();
  for (const p of profiles) vouchers.set(p.id, p);

  const paths = profiles
    .map((p) => p.avatar_path)
    .filter((p): p is string => typeof p === 'string' && !p.includes('_pending'));
  const avatarUrls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from('pin-photos')
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) avatarUrls.set(s.path, s.signedUrl);
    }
  }
  return { vouchers, avatarUrls };
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
  const tc = useTranslations('categories');
  const locale = useLocale();
  const category = categories.find((c) => c.id === pin.category_id) ?? null;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  // Live vouch INSERT/UPDATE/DELETE stream into the ['vouches', pin.id] cache
  // (see useRealtimeVouches); the query below reads that same key, so vouches
  // added by other members now appear live without a manual refresh.
  useRealtimeVouches(pin.id);

  // Google Place details rarely change and cost money per fetch — cache hard,
  // and share the cache with NewPlaceView via the same ['place-details', <id>]
  // key so pinning a just-viewed place reuses the already-fetched details.
  const { data: placeDetails = null } = useQuery({
    queryKey: ['place-details', pin.google_place_id],
    queryFn: () => fetchPlaceDetails(pin.google_place_id as string),
    enabled: !!pin.google_place_id,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const { data: vouches = EMPTY_VOUCHES } = useQuery({
    queryKey: ['vouches', pin.id],
    queryFn: () => fetchVouches(pin.id),
    staleTime: 60_000,
  });

  const voucherIds = useMemo(
    () => Array.from(new Set(vouches.map((v) => v.voucher_id))).sort(),
    [vouches],
  );

  // Profiles + signed avatar URLs for the current voucher set. Keyed by the id
  // list so it only refetches when the set of vouchers actually changes.
  const { data: voucherData = EMPTY_VOUCHER_DATA } = useQuery({
    queryKey: ['voucher-profiles', voucherIds],
    queryFn: () => fetchVoucherProfiles(voucherIds),
    enabled: voucherIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const vouchers = voucherData.vouchers;
  const avatarUrls = voucherData.avatarUrls;

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

  const otherVouches = useMemo(
    () => vouches.filter((v) => v.voucher_id !== pin.created_by),
    [vouches, pin.created_by],
  );

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
            {categoryLabel(tc, category)}
          </span>
        ) : null}
        <span className="text-sm text-[var(--muted)]">{pin.address}</span>
      </div>

      <PinPhotos
        pinId={pin.id}
        canUpload={currentUserId === pin.created_by}
        canDelete={canEdit}
      />

      {placeDetails ? (
        <div className="mt-4">
          <PlaceInfoCard place={placeDetails} />
        </div>
      ) : null}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-medium">
          {/* Creator counts unconditionally: their card below always renders
              (the vouch_note IS their vouch), so the number must match even
              if the auto-vouch row is missing on legacy pins. */}
          {t('vouchedBy')} ({otherVouches.length + 1})
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
                <time className="text-xs text-[var(--muted)]">{relativeTime(pin.created_at, locale)}</time>
              </div>
              <LocalizedText
                original={pin.vouch_note}
                translations={pin.translations}
                className="mt-1 whitespace-pre-wrap text-sm"
              />
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
                      {relativeTime(v.created_at, locale)}
                    </time>
                  </div>
                  {v.comment ? (
                    <LocalizedText
                      original={v.comment}
                      translations={v.translations}
                      className="mt-1 text-sm"
                    />
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

        {/* Creators don't vouch-toggle their own pin — their note is the vouch. */}
        {currentUserId !== pin.created_by ? (
          <VouchPanel
            pinId={pin.id}
            onChange={() => queryClient.invalidateQueries({ queryKey: ['vouches', pin.id] })}
          />
        ) : null}
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

  // Is this Google POI already a community pin? Runs in parallel with the
  // place-details fetch below; both are cached so re-opening the same place
  // (or reopening after adding it) is instant.
  const { data: existingPin = null, isLoading: byPlaceLoading } = useQuery({
    queryKey: ['pin-by-place', placeId],
    queryFn: async () => {
      const r = await fetch(`/api/pins/by-place/${encodeURIComponent(placeId)}`);
      return r.ok ? ((await r.json()) as Pin | null) : null;
    },
    staleTime: 60_000,
  });

  const { data: place = null, isLoading: placeLoading } = useQuery({
    queryKey: ['place-details', placeId],
    queryFn: () => fetchPlaceDetails(placeId),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  // Already pinned → show the pin immediately; ExistingPinView fetches its own
  // (cache-shared) place details, so there's no need to wait on ours first.
  if (existingPin) {
    return <ExistingPinView pin={existingPin} categories={categories} />;
  }

  if (byPlaceLoading || placeLoading) {
    return (
      <>
        <Drawer.Title className="font-serif text-xl">{tCommon('loading')}</Drawer.Title>
        <p className="mt-4 text-sm text-[var(--muted)]">{tPin('fetchingPlace')}</p>
      </>
    );
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
