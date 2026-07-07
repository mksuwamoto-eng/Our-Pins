'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AvatarUploader } from '@/components/onboarding/AvatarUploader';

interface Props {
  userId: string;
  initial: {
    displayName: string;
    instagram: string;
    website: string;
    bio: string;
    avatarPath: string;
    avatarUrl: string | null;
  };
}

export function ProfileEditForm({ userId, initial }: Props) {
  const t = useTranslations('onboarding');
  const tSettings = useTranslations('settings');
  const tPin = useTranslations('pin');
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [website, setWebsite] = useState(initial.website);
  const [bio, setBio] = useState(initial.bio);
  const [avatarPath, setAvatarPath] = useState(initial.avatarPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName.trim(),
        instagram: instagram.trim(),
        website: website.trim(),
        bio: bio.trim(),
        avatarPath: avatarPath || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? tSettings('saveFailed'));
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-1">
        <span className="block text-sm font-medium">{t('avatar')}</span>
        <AvatarUploader
          userId={userId}
          initialUrl={initial.avatarUrl}
          onChange={(path) => setAvatarPath(path)}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('displayName')}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={1}
          maxLength={60}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('bio')}</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t('bioHelp')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('instagram')}</label>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="yourhandle"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('website')}</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700">{tSettings('saved')}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {busy ? tSettings('saving') : tPin('saveChanges')}
      </button>
    </form>
  );
}
