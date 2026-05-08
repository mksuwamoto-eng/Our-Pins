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

  it('rejects an http (non-https) website', () => {
    expect(
      onboardingSchema.safeParse({ ...valid, website: 'http://example.com' }).success,
    ).toBe(false);
  });

  it('rejects an instagram handle with spaces', () => {
    expect(
      onboardingSchema.safeParse({ ...valid, instagram: 'has space' }).success,
    ).toBe(false);
  });
});
