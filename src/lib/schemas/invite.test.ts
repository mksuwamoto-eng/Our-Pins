import { describe, expect, it } from 'vitest';
import { INVITE_MAX_EXPIRY_DAYS, inviteCreateSchema } from './invite';

const DAY = 86_400_000;

describe('inviteCreateSchema', () => {
  it('defaults to one single-use link with no explicit expiry', () => {
    const parsed = inviteCreateSchema.parse({});
    expect(parsed.count).toBe(1);
    expect(parsed.maxUses).toBe(1);
    expect(parsed.expiresAt).toBeUndefined();
  });

  it('accepts a multi-use link with a future expiry', () => {
    const expiresAt = new Date(Date.now() + 30 * DAY).toISOString();
    const parsed = inviteCreateSchema.parse({ maxUses: 200, expiresAt });
    expect(parsed.maxUses).toBe(200);
    expect(parsed.expiresAt).toBe(expiresAt);
  });

  it('rejects an expiry in the past', () => {
    const expiresAt = new Date(Date.now() - DAY).toISOString();
    expect(inviteCreateSchema.safeParse({ expiresAt }).success).toBe(false);
  });

  it('rejects an expiry beyond the cap', () => {
    const expiresAt = new Date(Date.now() + (INVITE_MAX_EXPIRY_DAYS + 2) * DAY).toISOString();
    expect(inviteCreateSchema.safeParse({ expiresAt }).success).toBe(false);
  });

  it('rejects a seat count outside 1..1000', () => {
    expect(inviteCreateSchema.safeParse({ maxUses: 0 }).success).toBe(false);
    expect(inviteCreateSchema.safeParse({ maxUses: 1001 }).success).toBe(false);
  });

  it('treats an empty note as absent', () => {
    expect(inviteCreateSchema.parse({ note: '' }).note).toBeUndefined();
  });
});
