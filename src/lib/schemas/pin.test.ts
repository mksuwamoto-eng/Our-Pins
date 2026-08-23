import { describe, expect, it } from 'vitest';
import { derivePrefectureCity, pinCreateSchema } from './pin';

describe('derivePrefectureCity', () => {
  it('extracts prefecture from administrative_area_level_1', () => {
    const result = derivePrefectureCity([
      { long_name: 'Tokyo', short_name: 'Tokyo', types: ['administrative_area_level_1', 'political'] },
      { long_name: 'Shibuya City', short_name: 'Shibuya', types: ['locality', 'political'] },
    ]);
    expect(result.prefecture).toBe('Tokyo');
    expect(result.city).toBe('Shibuya City');
  });

  it('falls back to admin level 2 when locality is missing', () => {
    const result = derivePrefectureCity([
      { long_name: 'Hokkaido', short_name: 'Hokkaido', types: ['administrative_area_level_1'] },
      { long_name: 'Shibetsu District', short_name: 'Shibetsu', types: ['administrative_area_level_2'] },
    ]);
    expect(result.prefecture).toBe('Hokkaido');
    expect(result.city).toBe('Shibetsu District');
  });

  it('handles empty input', () => {
    expect(derivePrefectureCity(null)).toEqual({ prefecture: '', city: null });
    expect(derivePrefectureCity([])).toEqual({ prefecture: '', city: null });
  });
});

describe('pinCreateSchema', () => {
  it('accepts a valid payload', () => {
    const result = pinCreateSchema.safeParse({
      name: 'Hidden gem ramen',
      address: '1-2-3 Shibuya, Tokyo',
      lat: 35.66,
      lng: 139.7,
      prefecture: 'Tokyo',
      city: 'Shibuya',
      category_id: '11111111-1111-1111-1111-111111111111',
      vouch_note: 'Best tonkotsu in town',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty vouch_note', () => {
    const result = pinCreateSchema.safeParse({
      name: 'X',
      address: 'Y',
      lat: 0,
      lng: 0,
      prefecture: 'Tokyo',
      category_id: '11111111-1111-1111-1111-111111111111',
      vouch_note: '',
    });
    expect(result.success).toBe(false);
  });

  describe('tags', () => {
    const base = {
      name: 'X',
      address: 'Y',
      lat: 0,
      lng: 0,
      prefecture: 'Tokyo',
      category_id: '11111111-1111-1111-1111-111111111111',
      vouch_note: 'Good',
    };

    it('defaults to absent when omitted', () => {
      const result = pinCreateSchema.safeParse(base);
      expect(result.success).toBe(true);
      // The POST route coalesces to [] and the column defaults to '{}'.
      expect(result.success && result.data.tags).toBeUndefined();
    });

    it('accepts the vocabulary', () => {
      const result = pinCreateSchema.safeParse({ ...base, tags: ['greek', 'english-ok'] });
      expect(result.success).toBe(true);
      expect(result.success && result.data.tags).toEqual(['greek', 'english-ok']);
    });

    it('rejects a slug outside the vocabulary before Postgres sees it', () => {
      // Otherwise this surfaces as an opaque 23514 from pins_tags_vocab.
      expect(pinCreateSchema.safeParse({ ...base, tags: ['greek-food'] }).success).toBe(false);
      expect(pinCreateSchema.safeParse({ ...base, tags: ['Greek'] }).success).toBe(false);
    });

    it('de-duplicates rather than failing the cardinality check', () => {
      const result = pinCreateSchema.safeParse({ ...base, tags: ['greek', 'greek', 'greek'] });
      expect(result.success).toBe(true);
      expect(result.success && result.data.tags).toEqual(['greek']);
    });

    it('rejects more entries than the vocabulary holds', () => {
      const tags = ['greek', 'greek-speaking', 'english-ok', 'greek'];
      expect(pinCreateSchema.safeParse({ ...base, tags }).success).toBe(false);
    });
  });
});
