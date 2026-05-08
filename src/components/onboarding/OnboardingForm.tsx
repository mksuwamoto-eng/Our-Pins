'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { onboardingSchema, type OnboardingInput } from '@/lib/schemas/profile';
import { AvatarUploader } from './AvatarUploader';

interface Props {
  userId: string;
  initial: {
    displayName: string;
    displayPref: 'avatar_only' | 'avatar_name';
    instagram?: string | null;
    website?: string | null;
  };
}

export function OnboardingForm({ userId, initial }: Props) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: initial.displayName,
      displayPref: initial.displayPref,
      instagram: initial.instagram ?? '',
      website: initial.website ?? '',
      avatarPath: '',
    },
  });

  async function onSubmit(values: OnboardingInput) {
    setSubmitError(null);
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(json.error ?? tCommon('error'));
      return;
    }
    router.push('/');
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Field label={t('avatar')} help={t('avatarHelp')} error={errors.avatarPath?.message}>
        <AvatarUploader
          userId={userId}
          onChange={(path) => form.setValue('avatarPath', path, { shouldValidate: true })}
        />
      </Field>

      <Field label={t('displayName')} help={t('displayNameHelp')} error={errors.displayName?.message}>
        <input
          {...form.register('displayName')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </Field>

      <Field label={t('realName')} help={t('realNameHelp')} error={errors.realName?.message}>
        <input
          {...form.register('realName')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </Field>

      <Field label={t('displayPref')}>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="radio" value="avatar_name" {...form.register('displayPref')} />
            {t('displayPrefAvatarName')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="avatar_only" {...form.register('displayPref')} />
            {t('displayPrefAvatarOnly')}
          </label>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('instagram')} error={errors.instagram?.message}>
          <input
            {...form.register('instagram')}
            placeholder="yourhandle"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </Field>
        <Field label={t('website')} error={errors.website?.message}>
          <input
            {...form.register('website')}
            placeholder="https://"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </Field>
      </div>

      <Field error={errors.acceptedGuidelines?.message}>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...form.register('acceptedGuidelines')} className="mt-1" />
          <span>{t('guidelinesAccept')}</span>
        </label>
      </Field>

      {submitError ? (
        <p className="text-sm text-[var(--color-terracotta-500)]">{submitError}</p>
      ) : null}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {form.formState.isSubmitting ? tCommon('loading') : t('submit')}
      </button>
    </form>
  );
}

function Field({
  label,
  help,
  error,
  children,
}: {
  label?: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {label ? <span className="block text-sm font-medium">{label}</span> : null}
      {help ? <span className="block text-xs text-[var(--muted)]">{help}</span> : null}
      {children}
      {error ? <span className="block text-xs text-[var(--color-terracotta-500)]">{error}</span> : null}
    </div>
  );
}
