'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useFiltersStore } from '@/stores/filters';
import { useRealtimePins } from '@/lib/supabase/realtime';
import { getMapsLoader } from '@/lib/maps/loader';
import type { Category, Pin } from '@/lib/supabase/types';
import { PinSheet } from './PinSheet';
import { FilterBar } from './FilterBar';

const JAPAN_CENTER = { lat: 36.2048, lng: 138.2529 };

interface Props {
  initialPins: Pin[];
  categories: Category[];
}

export function MapView({ initialPins, categories }: Props) {
  const t = useTranslations('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const router = useRouter();

  const { categoryIds, prefectures, search, viewport, setViewport } = useFiltersStore();
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  useRealtimePins((newPin) => {
    setPins((prev) => [newPin, ...prev.filter((p) => p.id !== newPin.id)]);
  });

  // Initialise the Google Map.
  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    getMapsLoader().load().then((google) => {
      if (!active || !containerRef.current) return;
      const map = new google.maps.Map(containerRef.current, {
        center: viewport.center ?? JAPAN_CENTER,
        zoom: viewport.zoom ?? 5,
        mapId: 'OUR_PINS_MAP',
        disableDefaultUI: true,
        zoomControl: true,
      });
      map.addListener('idle', () => {
        const c = map.getCenter();
        const z = map.getZoom();
        if (c && typeof z === 'number') {
          setViewport({ center: { lat: c.lat(), lng: c.lng() }, zoom: z });
        }
      });
      mapRef.current = map;
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clustererRef.current?.clearMarkers();

    const filtered = pins.filter((p) => {
      if (categoryIds.length && !categoryIds.includes(p.category_id)) return false;
      if (prefectures.length && !prefectures.includes(p.prefecture)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.vouch_note.toLowerCase().includes(q)) return false;
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
      marker.addListener('click', () => setSelectedPinId(pin.id));
      return marker;
    });

    clustererRef.current = new MarkerClusterer({ map, markers });
    return () => {
      clustererRef.current?.clearMarkers();
    };
  }, [pins, categoryIds, prefectures, search, categoryById]);

  const selected = pins.find((p) => p.id === selectedPinId) ?? null;

  return (
    <div className="relative h-[calc(100vh-3.25rem)] w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <FilterBar categories={categories} />
      <button
        onClick={() => router.push('/pins/new')}
        aria-label={t('addPin')}
        className="absolute bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </button>
      <PinSheet pin={selected} category={selected ? categoryById.get(selected.category_id) ?? null : null} onClose={() => setSelectedPinId(null)} />
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
