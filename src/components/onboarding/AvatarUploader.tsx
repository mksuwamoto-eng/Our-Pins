'use client';

import imageCompression from 'browser-image-compression';
import { useState } from 'react';
import { Camera } from 'lucide-react';

export function AvatarUploader({
  userId: _userId,
  initialUrl,
  onChange,
  linePicture,
  lineLabel,
}: {
  userId: string;
  initialUrl?: string | null;
  onChange: (path: string) => void;
  // When present (LINE sign-ins), offer a one-click import of the photo
  // captured from LINE at sign-in. `lineLabel` is the localized button text.
  linePicture?: string | null;
  lineLabel?: string;
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importFromLine() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/profile/avatar/from-line', { method: 'POST' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Import failed');
      }
      const { path } = (await res.json()) as { path: string };
      onChange(path);
      // The LINE CDN URL is public, so it doubles as the preview image.
      if (linePicture) setPreview(linePicture);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
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
        throw new Error(json.error ?? 'Upload failed');
      }
      const { path } = (await res.json()) as { path: string };
      onChange(path);
      setPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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
        {busy ? <p>Uploading…</p> : null}
        {error ? <p className="text-[var(--color-terracotta-500)]">{error}</p> : null}
        {!busy && !error && preview ? <p className="text-[var(--muted)]">Looks good ✓</p> : null}
      </div>
    </div>
  );
}
