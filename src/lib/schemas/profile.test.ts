import { describe, expect, it } from 'vitest';
import { onboardingSchema } from './profile';

describe('onboardingSchema', () => {
  const valid = {
    displayName: 'Mako',
    avatarPath: 'avatars/mako.jpg',
    displayPref: 'avatar_name' as const,
    acceptedGuidelines: true as const,
  };

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
