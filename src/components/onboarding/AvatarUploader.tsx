'use client';

import imageCompression from 'browser-image-compression';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';

// API errors arrive as stable codes; map them to `pin.errors.*` message keys.
const IMAGE_ERROR_KEYS: Record<string, string> = {
  bad_image_type: 'badImageType',
  image_too_large: 'imageTooLarge',
};

export function AvatarUploader({
  userId: _userId,
  initialUrl,
  onChange,
  linePicture,
  lineLabel,
  uploadingLabel,
  readyLabel,
}: {
  userId: string;
  initialUrl?: string | null;
  onChange: (path: string) => void;
  // When present (LINE sign-ins), offer a one-click import of the photo
  // captured from LINE at sign-in. `lineLabel` is the localized button text.
  linePicture?: string | null;
  lineLabel?: string;
  uploadingLabel: string;
  readyLabel: string;
}) {
  const te = useTranslations('pin.errors');
  const tCommon = useTranslations('common');
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importFromLine() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/profile/avatar/from-line', { method: 'POST' });
      if (!res.ok) throw new Error('import failed');
      const { path } = (await res.json()) as { path: string };
      onChange(path);
      // The LINE CDN URL is public, so it doubles as the preview image.
      if (linePicture) setPreview(linePicture);
    } catch {
      setError(tCommon('uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });
      const fd = new FormData();
      fd.append('file', compressed, 'profile.jpg');
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const key = json.error ? IMAGE_ERROR_KEYS[json.error] : undefined;
        throw new Error(key ? te(key) : tCommon('uploadFailed'));
      }
      const { path } = (await res.json()) as { path: string };
      onChange(path);
      setPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-[var(--border)] bg-[var(--surface)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-6 w-6 text-[var(--muted)]" />
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      <div className="text-sm">
        {linePicture && lineLabel ? (
          <button
            type="button"
            onClick={importFromLine}
            disabled={busy}
            className="mb-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            {lineLabel}
          </button>
        ) : null}
        {busy ? <p>{uploadingLabel}</p> : null}
        {error ? <p className="text-[var(--color-terracotta-500)]">{error}</p> : null}
        {!busy && !error && preview ? (
          <p className="text-[var(--muted)]">{readyLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
