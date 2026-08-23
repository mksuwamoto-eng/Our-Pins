'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useFiltersStore } from '@/stores/filters';
import { useRealtimePins } from '@/lib/supabase/realtime';
import { getMapsLoader } from '@/lib/maps/loader';
import type { Category, Pin } from '@/lib/supabase/types';
import { categoryLabel } from '@/lib/i18n/category';
import { PinSheet, type SheetSelection } from './PinSheet';
import { FilterBar } from './FilterBar';

// The concierge is an on-demand chat FAB — keep its code (and its deps) out of
// the map's initial bundle. It's a client-only overlay, so no SSR needed.
const Concierge = dynamic(
  () => import('@/components/concierge/Concierge').then((m) => m.Concierge),
  { ssr: false },
);

const JAPAN_CENTER = { lat: 36.2048, lng: 138.2529 };
const TOKYO = { lat: 35.6812, lng: 139.7671 };
// One-time first-run banner: shown until the member opens any pin/place sheet
// or dismisses it. The map alone doesn't explain the core interaction (tap a
// place → community sheet), which is exactly where new members stalled.
const INTRO_SEEN_KEY = 'op-intro-seen';

export interface MemberOption {
  id: string;
  display_name: string;
}

interface Props {
  initialPins: Pin[];
  categories: Category[];
  members: MemberOption[];
}

export function MapView({ initialPins, categories, members }: Props) {
  const t = useTranslations('map');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categories');
  const tTag = useTranslations('tags');
  const containerRef = useRef<HTMLDivElement>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const router = useRouter();

  const { categoryIds, tags, prefectures, authorIds, setAuthorIds, search, setViewport } =
    useFiltersStore();
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Place selections (clicks on Google POIs that aren't pinned yet) live in
  // local state because they have no shareable ID. Pin selections live in the
  // URL (?pin=<id>) so they survive reloads and can be shared/back-buttoned.
  const [placeSelection, setPlaceSelection] = useState<SheetSelection>(null);
  // Pin created this session — the sheet flips to it after save and highlights
  // its (otherwise easily-missed) photo uploader.
  const [justSavedPinId, setJustSavedPinId] = useState<string | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const searchParams = useSearchParams();
  const pinIdFromUrl = searchParams.get('pin');
  const authorFromUrl = searchParams.get('author');

  // Member profile pages link here as /?author=<id> ("see X's pins on the
  // map"). Absorb the param into the filter store, then clean the URL.
  useEffect(() => {
    if (!authorFromUrl) return;
    setAuthorIds([authorFromUrl]);
    routerRef.current.replace('/', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorFromUrl]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) setShowIntro(true);
    } catch {
      // Private browsing without storage — just skip the banner.
    }
  }, []);

  function dismissIntro() {
    setShowIntro(false);
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // ignore
    }
  }

  const selection: SheetSelection = useMemo(() => {
    if (pinIdFromUrl) {
      const pin = pins.find((p) => p.id === pinIdFromUrl);
      if (pin) return { kind: 'pin', pin };
    }
    return placeSelection;
  }, [pinIdFromUrl, pins, placeSelection]);

  // Stable ref so click handlers bound inside the one-shot map init effect
  // always call the latest router instance.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  function selectPin(pinId: string) {
    routerRef.current.replace(`/?pin=${pinId}`, { scroll: false });
    setPlaceSelection(null);
  }

  function clearSelection() {
    routerRef.current.replace('/', { scroll: false });
    setPlaceSelection(null);
    setJustSavedPinId(null);
  }

  // Opening any sheet proves the member found the core interaction — the
  // banner's job is done.
  useEffect(() => {
    if (selection && showIntro) dismissIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Live count of pins per category, for the FilterBar dropdown. Counts every
  // loaded pin (ignores the active filters) so each number is a stable "how
  // many exist", not "how many are currently shown".
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pins) m[p.category_id] = (m[p.category_id] ?? 0) + 1;
    return m;
  }, [pins]);

  // Same idea for the tag axis. Unlike categories a pin can hold several tags,
  // so these count memberships and deliberately don't sum to pins.length.
  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pins) for (const tag of p.tags ?? []) m[tag] = (m[tag] ?? 0) + 1;
    return m;
  }, [pins]);

  // Lookup table: google_place_id -> Pin (so map clicks on POIs we already
  // have a pin for resolve to the existing pin instead of "add new").
  const pinByPlaceId = useMemo(() => {
    const m = new Map<string, Pin>();
    for (const p of pins) if (p.google_place_id) m.set(p.google_place_id, p);
    return m;
  }, [pins]);

  // Live pin feed. All three event kinds land here: without update/delete the
  // map kept showing other members' edited or archived pins until a reload.
  useRealtimePins((change) => {
    setPins((prev) => {
      if (change.type === 'delete') return prev.filter((p) => p.id !== change.id);
      const pin = change.pin;
      if (pin.archived_at) return prev.filter((p) => p.id !== pin.id);
      const i = prev.findIndex((p) => p.id === pin.id);
      if (i === -1) return [pin, ...prev];
      // Replace in place — reordering on every edit would shuffle the markers.
      const next = [...prev];
      next[i] = pin;
      return next;
    });
  });

  // Initialise the Google Map.
  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    getMapsLoader().load().then((google) => {
      if (!active || !containerRef.current) return;
      // Read the LIVE persisted viewport here (inside the async loader
      // callback), not the render-time `viewport` closure. The closure was
      // captured at mount — before zustand-persist rehydrated from
      // localStorage — so it held the Japan-wide default; the map opened there
      // and the idle listener below then wrote that default back, clobbering
      // the user's saved position. getState() is post-hydration by now.
      const saved = useFiltersStore.getState().viewport;
      const m = new google.maps.Map(containerRef.current, {
        center: saved.center ?? JAPAN_CENTER,
        zoom: saved.zoom ?? 5,
        mapId: 'OUR_PINS_MAP',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: true,
      });
      google.maps.event.addListenerOnce(m, 'tilesloaded', () => setTilesLoaded(true));
      m.addListener('idle', () => {
        const c = m.getCenter();
        const z = m.getZoom();
        if (c && typeof z === 'number') {
          setViewport({ center: { lat: c.lat(), lng: c.lng() }, zoom: z });
        }
      });
      // Click anywhere — if it's a POI, capture place_id and prevent the
      // default Google info window so our sheet handles it.
      m.addListener('click', (event: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
        if (event.placeId) {
          event.stop?.();
          const existing = pinByPlaceIdRef.current.get(event.placeId);
          if (existing) {
            selectPin(existing.id);
          } else {
            routerRef.current.replace('/', { scroll: false });
            setPlaceSelection({
              kind: 'place',
              placeId: event.placeId,
              location: event.latLng
                ? { lat: event.latLng.lat(), lng: event.latLng.lng() }
                : null,
            });
          }
        }
      });
      setMap(m);
    }).catch(() => {
      // Maps JS failed to load (network, key restriction) — without this the
      // map area shows the loading overlay forever.
      if (active) setMapLoadFailed(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pinByPlaceId is in a ref so the click handler above always sees the
  // latest map without re-binding the listener (which we can't easily do).
  const pinByPlaceIdRef = useRef(pinByPlaceId);
  useEffect(() => {
    pinByPlaceIdRef.current = pinByPlaceId;
  }, [pinByPlaceId]);

  // Render markers for our pins.
  useEffect(() => {
    if (!map) return;
    clustererRef.current?.clearMarkers();

    const filtered = pins.filter((p) => {
      if (categoryIds.length && !categoryIds.includes(p.category_id)) return false;
      if (tags.length && !(p.tags ?? []).some((tag) => tags.includes(tag))) return false;
      if (prefectures.length && !prefectures.includes(p.prefecture)) return false;
      if (authorIds.length && !authorIds.includes(p.created_by)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        // Search covers the pin name, note, address, its (localized) category
        // label, and both stored translations — so category words ("sushi",
        // "καφέ") and a reader's translated note both match.
        // Note: substring match only. Japanese-script names won't match Romaji
        // queries (e.g., "Ootoya" misses 大戸屋). Proper fix requires a
        // transliterated name column or a romaji search index.
        const cat = categoryById.get(p.category_id);
        const catLabel = cat ? categoryLabel(tCat, cat) : '';
        // Tag labels are in the haystack on purpose: typing "greek" finds the
        // tagged pins for members who never open the tag dropdown.
        const tagLabels = (p.tags ?? []).map((tag) => tTag(tag)).join('\n');
        const haystack = `${p.name}\n${p.vouch_note}\n${p.address}\n${catLabel}\n${tagLabels}\n${p.translations?.el ?? ''}\n${p.translations?.en ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const markers = filtered.map((pin) => {
      const cat = categoryById.get(pin.category_id);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: Number(pin.lat), lng: Number(pin.lng) },
        map,
        content: createMarkerEl(cat?.color ?? '#3a4d8a'),
      });
      marker.addListener('click', () => selectPin(pin.id));
      return marker;
    });

    clustererRef.current = new MarkerClusterer({ map, markers });
    return () => {
      clustererRef.current?.clearMarkers();
    };
  }, [map, pins, categoryIds, tags, prefectures, authorIds, search, categoryById, tCat, tTag]);

  function handlePinSaved(p: Pin) {
    setPins((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    setJustSavedPinId(p.id);
    selectPin(p.id);
  }

  function handlePinUpdated(p: Pin) {
    setPins((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    // Sheet auto-rerenders from the URL + updated pins list; no selection set.
  }

  function handlePinDeleted(id: string) {
    setPins((prev) => prev.filter((x) => x.id !== id));
    if (pinIdFromUrl === id) clearSelection();
  }

  return (
    <div className="relative h-[calc(100vh-3.25rem)] w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!tilesLoaded ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)] text-sm text-[var(--muted)]"
        >
          {mapLoadFailed ? t('loadError') : tCommon('loading')}
        </div>
      ) : null}
      <FilterBar
        categories={categories}
        members={members}
        counts={categoryCounts}
        tagCounts={tagCounts}
      />
      {showIntro && tilesLoaded ? (
        <div className="absolute inset-x-3 top-16 z-20 mx-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <p className="text-sm text-[var(--fg)]">{t('welcome')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                map?.panTo(TOKYO);
                map?.setZoom(12);
                dismissIntro();
              }}
              className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white"
            >
              {t('welcomeCity')}
            </button>
            <a href="/guide" className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs">
              {t('welcomeGuide')}
            </a>
            <button
              onClick={dismissIntro}
              className="ml-auto px-2 py-1.5 text-xs text-[var(--muted)] underline"
            >
              {t('gotIt')}
            </button>
          </div>
        </div>
      ) : null}
      <Concierge />
      <button
        onClick={() => router.push('/pins/new')}
        aria-label={t('addPin')}
        className="absolute bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg"
        title={t('addPlaceTooltip')}
      >
        <Plus className="h-6 w-6" />
      </button>
      <PinSheet
        selection={selection}
        categories={categories}
        justSavedPinId={justSavedPinId}
        onClose={clearSelection}
        onPinSaved={handlePinSaved}
        onPinUpdated={handlePinUpdated}
        onPinDeleted={handlePinDeleted}
      />
    </div>
  );
}

function createMarkerEl(color: string) {
  const div = document.createElement('div');
  div.style.width = '28px';
  div.style.height = '28px';
  div.style.borderRadius = '999px';
  div.style.background = color;
  div.style.border = '2px solid white';
  div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  return div;
}
