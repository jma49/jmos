import { describe, expect, it } from 'vitest';
import { nextSeason, parseSeason, SEASONS, seasonOf } from './season';

describe('the season at the window', () => {
  it('follows the northern meteorological seasons, month by month', () => {
    const byMonth = Array.from({ length: 12 }, (_, month) => seasonOf(new Date(2026, month, 15)));
    expect(byMonth).toEqual(['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
  });

  it('turns on the first day of March, June, September and December', () => {
    expect(seasonOf(new Date(2026, 1, 28, 23, 59))).toBe('winter');
    expect(seasonOf(new Date(2026, 2, 1))).toBe('spring');
    expect(seasonOf(new Date(2026, 4, 31, 23, 59))).toBe('spring');
    expect(seasonOf(new Date(2026, 5, 1))).toBe('summer');
    expect(seasonOf(new Date(2026, 7, 31, 23, 59))).toBe('summer');
    expect(seasonOf(new Date(2026, 8, 1))).toBe('autumn');
    expect(seasonOf(new Date(2026, 10, 30, 23, 59))).toBe('autumn');
    expect(seasonOf(new Date(2026, 11, 1))).toBe('winter');
    expect(seasonOf(new Date(2027, 0, 1))).toBe('winter');
  });

  it('reads a season from the address, and nothing else', () => {
    expect(parseSeason('winter')).toBe('winter');
    expect(parseSeason(' Autumn ')).toBe('autumn');
    expect(parseSeason('fall')).toBeNull();
    expect(parseSeason('')).toBeNull();
    expect(parseSeason(null)).toBeNull();
  });

  it('goes round the year', () => {
    expect(SEASONS.map(nextSeason)).toEqual(['summer', 'autumn', 'winter', 'spring']);
  });
});
