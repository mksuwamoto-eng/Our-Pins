'use client';

import imageCompression from 'browser-image-compression';
import { useState } from 'react';
import { Camera } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AvatarUploader({
  userId,
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
      const path = `avatars/${userId}/profile.jpg`;
      const supabase = getSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage.from('pin-photos').upload(path, compressed, {
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (upErr) throw upErr;
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
