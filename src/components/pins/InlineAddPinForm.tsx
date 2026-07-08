'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Category, Pin } from '@/lib/supabase/types';
import { categoryLabel } from '@/lib/i18n/category';

interface FetchedPlace {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  addressComponents: Array<{ longText: string; shortText: string; types: string[] }>;
}

interface Props {
  place: FetchedPlace;
  categories: Category[];
  onSaved: (pin: Pin) => void;
}

export function InlineAddPinForm({ place, categories, onSaved }: Props) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const tc = useTranslations('categories');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [vouchNote, setVouchNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const components = place.addressComponents.map((c) => ({
        long_name: c.longText,
        short_name: c.shortText,
        types: c.types,
      }));
      const prefecture =
        components.find((c) => c.types.includes('administrative_area_level_1'))?.long_name ?? '';
      const city =
        components.find((c) => c.types.includes('locality'))?.long_name ??
        components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ??
        null;

      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: place.name,
          google_place_id: place.placeId,
          address: place.address,
          lat: place.location.lat,
          lng: place.location.lng,
          prefecture,
          city,
          address_components: components,
          category_id: categoryId,
          vouch_note: vouchNote.trim(),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? tCommon('error'));
      }
      const created = (await res.json()) as Pin;
      onSaved(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">{t('category')}</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(tc, c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('vouchNote')}</label>
        <textarea
          value={vouchNote}
          onChange={(e) => setVouchNote(e.target.value)}
          rows={4}
          maxLength={1000}
          required
          placeholder={t('vouchPlaceholder')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>
      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
      {/* Only disable while submitting. A missing note is caught by the
          textarea's `required` (native validation prompts the user) — a
          note-based disable made the button look dead with no explanation. */}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? tCommon('loading') : t('saveAndVouch')}
      </button>
    </form>
  );
}
