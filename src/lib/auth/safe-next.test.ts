import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('passes through same-origin relative paths', () => {
    expect(safeNext('/')).toBe('/');
    expect(safeNext('/board')).toBe('/board');
    expect(safeNext('/members/123?tab=pins')).toBe('/members/123?tab=pins');
  });

  it('rejects open-redirect vectors, falling back to /', () => {
    expect(safeNext('@evil.com')).toBe('/');
    expect(safeNext('.evil.com')).toBe('/');
    expect(safeNext('//evil.com')).toBe('/'); // protocol-relative
    expect(safeNext('/\\evil.com')).toBe('/'); // backslash bypass
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('http://evil.com')).toBe('/');
  });

  it('rejects missing / non-string / empty values', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext('relative/no/slash')).toBe('/');
  });
});
