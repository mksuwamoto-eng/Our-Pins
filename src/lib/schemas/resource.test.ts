import { describe, expect, it } from 'vitest';
import { resourceCreateSchema } from './resource';

describe('resourceCreateSchema', () => {
  const valid = { category: 'how_to' as const, title: 'Marriage certificate', body: 'Go to city hall.' };

  it('accepts a payload without url', () => {
    const parsed = resourceCreateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.url).toBeUndefined();
  });

  it('normalizes bare and http:// urls to https://', () => {
    const bare = resourceCreateSchema.safeParse({ ...valid, url: 'example.com/guide' });
    expect(bare.success).toBe(true);
    if (bare.success) expect(bare.data.url).toBe('https://example.com/guide');
    const http = resourceCreateSchema.safeParse({ ...valid, url: 'http://example.com' });
    expect(http.success).toBe(true);
    if (http.success) expect(http.data.url).toBe('https://example.com');
  });

  it('coerces an empty url to undefined (regression: "" passed validation but violated the DB https-only CHECK)', () => {
    for (const url of ['', '   ']) {
      const parsed = resourceCreateSchema.safeParse({ ...valid, url });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.url).toBeUndefined();
    }
  });

  it('rejects an invalid category and out-of-range lengths', () => {
    expect(resourceCreateSchema.safeParse({ ...valid, category: 'job' }).success).toBe(false);
    expect(resourceCreateSchema.safeParse({ ...valid, title: 'x'.repeat(121) }).success).toBe(false);
    expect(resourceCreateSchema.safeParse({ ...valid, body: 'x'.repeat(5001) }).success).toBe(false);
    expect(resourceCreateSchema.safeParse({ ...valid, body: '' }).success).toBe(false);
  });
});
