'use client';

import imageCompression from 'browser-image-compression';
import { useState } from 'react';
import { Camera } from 'lucide-react';

export function AvatarUploader({
  userId: _userId,
  onChange,
}: {
  userId: string;
  onChange: (path: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {busy ? <p>Uploading…</p> : null}
        {error ? <p className="text-[var(--color-terracotta-500)]">{error}</p> : null}
        {!busy && !error && preview ? <p className="text-[var(--muted)]">Looks good ✓</p> : null}
      </div>
    </div>
  );
}
