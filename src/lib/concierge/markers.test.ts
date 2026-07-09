import { describe, expect, it } from 'vitest';
import { ANY_MARKER, PIN_MARKER, RES_MARKER } from './markers';

const PIN_ID = '11111111-2222-3333-4444-555555555555';
const RES_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MIXED = `Try [[pin:${PIN_ID}|Cafe Kalimera]] — and Eleni's guide [[res:${RES_ID}|Marriage certificate]] covers the paperwork.`;

describe('concierge markers', () => {
  it('PIN_MARKER and RES_MARKER each match only their own kind', () => {
    expect([...MIXED.matchAll(PIN_MARKER)].map((m) => m[1])).toEqual([PIN_ID]);
    expect([...MIXED.matchAll(RES_MARKER)].map((m) => m[1])).toEqual([RES_ID]);
  });

  it('ANY_MARKER yields both kinds in document order with kind captured', () => {
    const matches = [...MIXED.matchAll(ANY_MARKER)].map((m) => [m[1], m[2], m[3]]);
    expect(matches).toEqual([
      ['pin', PIN_ID, 'Cafe Kalimera'],
      ['res', RES_ID, 'Marriage certificate'],
    ]);
  });

  it('ignores malformed markers (bad id, unknown kind)', () => {
    const bad = 'nope [[res:not-a-uuid|x]] [[member:11111111-2222-3333-4444-555555555555|y]]';
    expect([...bad.matchAll(ANY_MARKER)]).toHaveLength(0);
  });

  it('matches labels containing single brackets (regression: "[test φ4] …" title broke the match)', () => {
    const text = `see [[res:${RES_ID}|Guide [2026 edition] to visas]] now`;
    const matches = [...text.matchAll(RES_MARKER)];
    expect(matches).toHaveLength(1);
    expect(matches[0][2]).toBe('Guide [2026 edition] to visas');
    expect([...text.matchAll(ANY_MARKER)][0][3]).toBe('Guide [2026 edition] to visas');
  });

  it('matches labels ENDING in a bracket without leaking a stray "]" (regression: three closing brackets)', () => {
    const text = `see [[res:${RES_ID}|Salary guide [2026]]] now`;
    const matches = [...text.matchAll(RES_MARKER)];
    expect(matches).toHaveLength(1);
    expect(matches[0][2]).toBe('Salary guide [2026]');
    expect(text.replace(RES_MARKER, 'LINK')).toBe('see LINK now');
  });
});
