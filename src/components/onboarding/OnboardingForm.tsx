'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { onboardingSchema, type OnboardingInput } from '@/lib/schemas/profile';
import type { Resolver } from 'react-hook-form';
import { AvatarUploader } from './AvatarUploader';

interface Props {
  userId: string;
  linePicture?: string | null;
  // Already-imported avatar (usually the LINE photo, brought across at sign-in).
  avatarUrl?: string | null;
  initial: {
    firstName: string;
    lastName: string;
    instagram?: string | null;
    website?: string | null;
    linkedin?: string | null;
    bio?: string | null;
  };
}

export function OnboardingForm({ userId, linePicture, avatarUrl, initial }: Props) {
  const t = useTranslations('onboarding');
  const te = useTranslations('onboarding.errors');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Zod messages are stable codes (see schemas/profile.ts); map them to
  // localized text, falling back to the raw message for anything unmapped
  // (e.g. default max-length messages).
  const ERROR_CODES = new Set([
    'firstNameRequired',
    'lastNameRequired',
    'instagramInvalid',
    'linkedinInvalid',
    'bioTooLong',
    'guidelinesRequired',
    'nicknameRequired',
  ]);
  const loc = (msg?: string) => (msg && ERROR_CODES.has(msg) ? te(msg) : msg);

  const form = useForm<OnboardingInput>({
    // The schema is a ZodEffects (superRefine on the nickname), so the resolver
    // can't infer the field type from the object shape alone.
    resolver: zodResolver(onboardingSchema) as Resolver<OnboardingInput>,
    defaultValues: {
      firstName: initial.firstName,
      lastName: initial.lastName,
      useNickname: false,
      nickname: '',
      instagram: initial.instagram ?? '',
      website: initial.website ?? '',
      linkedin: initial.linkedin ?? '',
      bio: initial.bio ?? '',
      avatarPath: '',
    },
  });

  const useNickname = form.watch('useNickname');

  async function onSubmit(values: OnboardingInput) {
    setSubmitError(null);
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(json.error === 'name_taken' ? te('nameTaken') : tCommon('error'));
      return;
    }
    router.push('/');
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Field
        label={t('avatar')}
        help={avatarUrl ? t('avatarHelpImported') : t('avatarHelp')}
        error={loc(errors.avatarPath?.message)}
      >
        <AvatarUploader
          userId={userId}
          initialUrl={avatarUrl}
          linePicture={linePicture}
          lineLabel={t('useLinePhoto')}
          uploadingLabel={t('photoUploading')}
          readyLabel={t('photoReady')}
          onChange={(path) => form.setValue('avatarPath', path, { shouldValidate: true })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('firstName')} error={loc(errors.firstName?.message)}>
          <input
            {...form.register('firstName')}
            autoComplete="given-name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </Field>
        <Field label={t('lastName')} error={loc(errors.lastName?.message)}>
          <input
            {...form.register('lastName')}
            autoComplete="family-name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </Field>
      </div>
      <p className="-mt-4 text-sm text-[var(--muted)]">{t('nameHelp')}</p>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...form.register('useNickname')} className="mt-1" />
          <span>{t('useNickname')}</span>
        </label>
        {useNickname ? (
          <Field help={t('nicknameHelp')} error={loc(errors.nickname?.message)}>
            <input
              {...form.register('nickname')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </Field>
        ) : null}
      </div>

      <details className="rounded-lg border border-[var(--border)] px-4 py-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-[var(--muted)]">
          {t('moreOptional')}
        </summary>
        <div className="mt-4 space-y-6">
          <Field label={t('bio')} help={t('bioHelp')} error={loc(errors.bio?.message)}>
            <textarea
              {...form.register('bio')}
              rows={3}
              placeholder={t('bioPlaceholder')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </Field>

          <Field label={t('linkedin')} help={t('linkedinHelp')} error={loc(errors.linkedin?.message)}>
            <input
              {...form.register('linkedin')}
              inputMode="url"
              placeholder="linkedin.com/in/…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('instagram')} error={loc(errors.instagram?.message)}>
              <input
                {...form.register('instagram')}
                placeholder="@handle"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </Field>
            <Field label={t('website')} error={loc(errors.website?.message)}>
              <input
                {...form.register('website')}
                placeholder="https://…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </Field>
          </div>
        </div>
      </details>

      <Field error={loc(errors.acceptedGuidelines?.message)}>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...form.register('acceptedGuidelines')} className="mt-1" />
          <span>
            {t.rich('guidelinesAccept', {
              link: (chunks) => (
                <a
                  href="/guidelines"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </span>
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
