'use client';

import imageCompression from 'browser-image-compression';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { PinPhoto } from '@/lib/supabase/types';

const MAX_PHOTOS = 4;

interface PhotoItem {
  id: string;
  url: string;
}

async function fetchPinPhotos(pinId: string): Promise<PhotoItem[]> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from('pin_photos')
    .select('id, storage_path, sort_order')
    .eq('pin_id', pinId)
    .order('sort_order', { ascending: true });
  const rows = (data ?? []) as Pick<PinPhoto, 'id' | 'storage_path' | 'sort_order'>[];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage
    .from('pin-photos')
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    );
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  return rows
    .map((r) => ({ id: r.id, url: urlByPath.get(r.storage_path) }))
    .filter((p): p is PhotoItem => typeof p.url === 'string');
}

const EMPTY: PhotoItem[] = [];

export function PinPhotos({
  pinId,
  canUpload,
  canDelete,
}: {
  pinId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: photos = EMPTY } = useQuery({
    queryKey: ['pin-photos', pinId],
    queryFn: () => fetchPinPhotos(pinId),
    staleTime: 60_000,
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after an error
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const fd = new FormData();
      fd.append('file', compressed, file.name);
      const res = await fetch(`/api/pins/${pinId}/photos`, { method: 'POST', body: fd });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Upload failed');
      }
      await queryClient.invalidateQueries({ queryKey: ['pin-photos', pinId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/pins/${pinId}/photos?photoId=${photoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Delete failed');
      }
      await queryClient.invalidateQueries({ queryKey: ['pin-photos', pinId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const showAdd = canUpload && photos.length < MAX_PHOTOS;
  if (!photos.length && !showAdd) return null;

  return (
    <div className="mt-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p) => (
          <div key={p.id} className="relative shrink-0">
            <button type="button" onClick={() => setLightbox(p.url)} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="h-24 w-24 rounded-lg object-cover"
                loading="lazy"
              />
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={busy}
                aria-label={t('removePhoto')}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {showAdd ? (
          <label className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)]">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-[11px]">{t('addPhoto')}</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
              disabled={busy}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-[var(--color-terracotta-500)]">{error}</p> : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label={tCommon('close')}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      ) : null}
    </div>
  );
}
