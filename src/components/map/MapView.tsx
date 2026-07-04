'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useFiltersStore } from '@/stores/filters';
import { Concierge } from '@/components/concierge/Concierge';
import { useRealtimePins } from '@/lib/supabase/realtime';
import { getMapsLoader } from '@/lib/maps/loader';
import type { Category, Pin } from '@/lib/supabase/types';
import { PinSheet, type SheetSelection } from './PinSheet';
import { FilterBar } from './FilterBar';

const JAPAN_CENTER = { lat: 36.2048, lng: 138.2529 };

interface Props {
  initialPins: Pin[];
  categories: Category[];
}

export function MapView({ initialPins, categories }: Props) {
  const t = useTranslations('map');
  const tCommon = useTranslations('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const router = useRouter();

  const { categoryIds, prefectures, search, viewport, setViewport } = useFiltersStore();
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Place selections (clicks on Google POIs that aren't pinned yet) live in
  // local state because they have no shareable ID. Pin selections live in the
  // URL (?pin=<id>) so they survive reloads and can be shared/back-buttoned.
  const [placeSelection, setPlaceSelection] = useState<SheetSelection>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const searchParams = useSearchParams();
  const pinIdFromUrl = searchParams.get('pin');

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
  }

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Lookup table: google_place_id -> Pin (so map clicks on POIs we already
  // have a pin for resolve to the existing pin instead of "add new").
  const pinByPlaceId = useMemo(() => {
    const m = new Map<string, Pin>();
    for (const p of pins) if (p.google_place_id) m.set(p.google_place_id, p);
    return m;
  }, [pins]);

  useRealtimePins((newPin) => {
    setPins((prev) => [newPin, ...prev.filter((p) => p.id !== newPin.id)]);
  });

  // Initialise the Google Map.
  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    getMapsLoader().load().then((google) => {
      if (!active || !containerRef.current) return;
      const m = new google.maps.Map(containerRef.current, {
        center: viewport.center ?? JAPAN_CENTER,
        zoom: viewport.zoom ?? 5,
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
      if (prefectures.length && !prefectures.includes(p.prefecture)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        // Note: substring match only. Japanese-script names won't match Romaji
        // queries (e.g., "Ootoya" misses 大戸屋). Proper fix requires a
        // transliterated name column or a romaji search index.
        const haystack = `${p.name}\n${p.vouch_note}\n${p.address}`.toLowerCase();
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
  }, [map, pins, categoryIds, prefectures, search, categoryById]);

  function handlePinSaved(p: Pin) {
    setPins((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
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
      <FilterBar categories={categories} />
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
