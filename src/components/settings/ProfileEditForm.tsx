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
    linkedin: string;
    bio: string;
    avatarPath: string;
    avatarUrl: string | null;
  };
}

// API validation errors arrive as stable codes; map them to localized text.
const FIELD_ERROR_CODES = new Set(['instagramInvalid', 'linkedinInvalid', 'bioTooLong']);

export function ProfileEditForm({ userId, initial }: Props) {
  const t = useTranslations('onboarding');
  const te = useTranslations('onboarding.errors');
  const tSettings = useTranslations('settings');
  const tPin = useTranslations('pin');
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [linkedin, setLinkedin] = useState(initial.linkedin);
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
        linkedin: linkedin.trim(),
        website: website.trim(),
        bio: bio.trim(),
        avatarPath: avatarPath || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      const code = json.error;
      setError(
        code === 'name_taken'
          ? tSettings('nameTaken')
          : code && FIELD_ERROR_CODES.has(code)
            ? te(code)
            : tSettings('saveFailed'),
      );
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
          uploadingLabel={t('photoUploading')}
          readyLabel={t('photoReady')}
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

      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('linkedin')}</label>
        <input
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          inputMode="url"
          placeholder="linkedin.com/in/…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('instagram')}</label>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('website')}</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
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
