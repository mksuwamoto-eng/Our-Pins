'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getMapsLoader } from '@/lib/maps/loader';
import type { Category } from '@/lib/supabase/types';
import { placeToPinFields } from '@/lib/maps/places';

interface FormValues {
  vouch_note: string;
  category_id: string;
}

export function PinForm({ categories }: { categories: Category[] }) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState<ReturnType<typeof placeToPinFields> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: { vouch_note: '', category_id: categories[0]?.id ?? '' },
  });

  useEffect(() => {
    if (!inputRef.current) return;
    let active = true;
    getMapsLoader().load().then((google) => {
      if (!active || !inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'jp' },
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components'],
      });
      ac.addListener('place_changed', () => {
        const p = ac.getPlace();
        if (!p.geometry?.location || !p.place_id || !p.name || !p.formatted_address) {
          setPlace(null);
          return;
        }
        setPlace(
          placeToPinFields({
            id: p.place_id,
            displayName: p.name,
            formattedAddress: p.formatted_address,
            location: { latitude: p.geometry.location.lat(), longitude: p.geometry.location.lng() },
            addressComponents: (p.address_components ?? []).map((c) => ({
              longText: c.long_name,
              shortText: c.short_name,
              types: c.types,
            })),
          }),
        );
      });
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    if (!place) {
      setSubmitError(t('pickPlaceError'));
      return;
    }
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...place, ...values }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(json.error ?? tCommon('error'));
      return;
    }
    const created = (await res.json()) as { id: string };
    router.push(`/pins/${created.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('placeLabel')}</label>
        <input
          ref={inputRef}
          placeholder={t('placeSearchPlaceholder')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
        {place ? (
          <p className="text-xs text-[var(--muted)]">
            {place.name} — {place.address}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('category')}</label>
        <select
          {...form.register('category_id', { required: true })}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('vouchNote')}</label>
        <textarea
          {...form.register('vouch_note', { required: true, minLength: 1, maxLength: 1000 })}
          rows={5}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>

      {submitError ? (
        <p className="text-sm text-[var(--color-terracotta-500)]">{submitError}</p>
      ) : null}

      <button
        type="submit"
        disabled={!place || form.formState.isSubmitting}
        className="rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {form.formState.isSubmitting ? tCommon('loading') : t('save')}
      </button>
    </form>
  );
}
