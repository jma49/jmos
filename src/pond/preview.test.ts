import { describe, expect, it } from 'vitest';
import { festivalOn, moonAge, moonLit } from './preview.js';

describe('the moon', () => {
  it('is new, then full, as the calendar has it', () => {
    // a new moon on 2026-02-17 and a full moon on 2026-03-03 (UTC)
    expect(moonLit(moonAge(new Date(Date.UTC(2026, 1, 17, 12))))).toBeLessThan(0.05);
    expect(moonLit(moonAge(new Date(Date.UTC(2026, 2, 3, 12))))).toBeGreaterThan(0.95);
  });
});

describe('the festivals', () => {
  it('fall on their days, and only near them', () => {
    expect(festivalOn(new Date(2026, 1, 17))).toBe('spring');
    expect(festivalOn(new Date(2026, 1, 19))).toBe('spring');
    expect(festivalOn(new Date(2026, 3, 5))).toBe('qingming');
    expect(festivalOn(new Date(2026, 5, 19))).toBe('dragon');
    expect(festivalOn(new Date(2026, 8, 25))).toBe('midautumn');
    expect(festivalOn(new Date(2026, 6, 1))).toBe(null);
  });
});
