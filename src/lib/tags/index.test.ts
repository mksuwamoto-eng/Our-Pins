import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAG_SLUGS, MAX_TAGS_PER_PIN, isTagSlug } from './index';

describe('tag vocabulary', () => {
  it('has no duplicates', () => {
    expect(new Set(TAG_SLUGS).size).toBe(TAG_SLUGS.length);
  });

  it('recognises its own slugs and nothing else', () => {
    for (const s of TAG_SLUGS) expect(isTagSlug(s)).toBe(true);
    expect(isTagSlug('Greek')).toBe(false);
    expect(isTagSlug('greek ')).toBe(false);
    expect(isTagSlug('')).toBe(false);
  });

  // The one drift that silently breaks saving: this constant and the DB CHECK
  // disagreeing. The migration text is the source of truth, so read it rather
  // than restating the list in a second place here.
  it('matches the pins_tags_vocab CHECK in migration 0034', () => {
    const sql = readFileSync('supabase/migrations/0034_pin_tags.sql', 'utf8');
    const arrayLiteral = sql.match(/tags <@ array\[([^\]]+)\]/)?.[1];
    expect(arrayLiteral, 'CHECK constraint not found in 0034').toBeTruthy();
    const fromSql = [...arrayLiteral!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(fromSql).toEqual([...TAG_SLUGS]);

    const cardinality = sql.match(/cardinality\(tags\) <= (\d+)/)?.[1];
    expect(Number(cardinality)).toBe(MAX_TAGS_PER_PIN);
  });
});
