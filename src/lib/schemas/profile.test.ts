import { describe, expect, it } from 'vitest';
import { onboardingSchema, resolveNames } from './profile';

describe('onboardingSchema', () => {
  const valid = {
    firstName: 'Makoto',
    lastName: 'Suwamoto',
    avatarPath: 'avatars/mako.jpg',
    displayPref: 'avatar_name' as const,
    acceptedGuidelines: true as const,
  };

  it('requires both a first name and a surname', () => {
    expect(onboardingSchema.safeParse({ ...valid, firstName: '' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, lastName: '  ' }).success).toBe(false);
  });

  it('requires a nickname once the opt-in box is ticked', () => {
    expect(onboardingSchema.safeParse({ ...valid, useNickname: true }).success).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...valid, useNickname: true, nickname: 'Mako' }).success,
    ).toBe(true);
  });

  it('accepts the minimum valid payload', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when guidelines not accepted', () => {
    expect(onboardingSchema.safeParse({ ...valid, acceptedGuidelines: false }).success).toBe(false);
  });

  it('prepends https:// to a bare website and upgrades http:// to https://', () => {
    const bare = onboardingSchema.safeParse({ ...valid, website: 'example.com' });
    expect(bare.success).toBe(true);
    if (bare.success) expect(bare.data.website).toBe('https://example.com');
    // http:// must be upgraded — the DB CHECK only accepts ^https://.
    const http = onboardingSchema.safeParse({ ...valid, website: 'http://example.com' });
    expect(http.success).toBe(true);
    if (http.success) expect(http.data.website).toBe('https://example.com');
    // an already-https URL is left intact.
    const https = onboardingSchema.safeParse({ ...valid, website: 'https://example.com' });
    if (https.success) expect(https.data.website).toBe('https://example.com');
  });

  it('rejects an instagram handle with spaces', () => {
    expect(
      onboardingSchema.safeParse({ ...valid, instagram: 'has space' }).success,
    ).toBe(false);
  });

  it('strips a leading @ from an instagram handle', () => {
    const parsed = onboardingSchema.safeParse({ ...valid, instagram: '@mako.jp' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.instagram).toBe('mako.jp');
  });
});

describe('resolveNames', () => {
  const base = onboardingSchema.parse({
    firstName: 'Makoto',
    lastName: 'Suwamoto',
    avatarPath: 'avatars/mako.jpg',
    displayPref: 'avatar_name' as const,
    acceptedGuidelines: true as const,
  });

  it('shows the real name by default', () => {
    expect(resolveNames(base)).toEqual({
      realName: 'Makoto Suwamoto',
      displayName: 'Makoto Suwamoto',
    });
  });

  it('keeps the real name private when a nickname is chosen', () => {
    const withNickname = onboardingSchema.parse({
      firstName: 'Makoto',
      lastName: 'Suwamoto',
      useNickname: true,
      nickname: 'Mako',
      avatarPath: 'avatars/mako.jpg',
      displayPref: 'avatar_name' as const,
      acceptedGuidelines: true as const,
    });
    expect(resolveNames(withNickname)).toEqual({
      realName: 'Makoto Suwamoto',
      displayName: 'Mako',
    });
  });
});
