import { describe, expect, it } from 'vitest';
import { conditionOf, effectsOf, phaseAt, seasonOf } from './weather';

describe('the weather on the pond', () => {
  it('groups the WMO codes as the desktop does', () => {
    expect([0, 2, 3, 45, 53, 63, 81, 73, 95].map(conditionOf)).toEqual(['clear', 'cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'rain', 'snow', 'storm']);
  });
  it('rains for drizzle, rain and storm, harder each time', () => {
    const r = (['drizzle', 'rain', 'storm'] as const).map((c) => effectsOf(c).rain);
    expect(r[0]).toBeGreaterThan(0);
    expect(r[1]).toBeGreaterThan(r[0]);
    expect(r[2]).toBeGreaterThan(r[1]);
    expect(effectsOf('clear').rain).toBe(0);
    expect(effectsOf('storm').thunder).toBe(true);
  });
  it('snows for snow, hazes for fog, and dims for cloud', () => {
    expect(effectsOf('snow').snow).toBeGreaterThan(0);
    expect(effectsOf('fog').fog).toBeGreaterThan(0);
    expect(effectsOf('overcast').light).toBeLessThan(effectsOf('cloudy').light);
    expect(effectsOf('cloudy').glint).toBeLessThan(effectsOf('clear').glint);
  });
});

describe('the season south of the equator', () => {
  it('is half a year on, and wraps round the year', () => {
    expect(seasonOf(2, 35)).toBe(2);
    expect(seasonOf(2, -33)).toBe(14);
    expect(seasonOf(20, -33)).toBe(8);
  });
});

describe('the time of day from the place’s own sun', () => {
  it('follows sunrise and sunset', () => {
    expect(phaseAt(6 * 60, 6 * 60 + 10, 18 * 60)).toBe('dawn');
    expect(phaseAt(12 * 60, 6 * 60 + 10, 18 * 60)).toBe('day');
    expect(phaseAt(18 * 60, 6 * 60 + 10, 18 * 60)).toBe('dusk');
    expect(phaseAt(23 * 60, 6 * 60 + 10, 18 * 60)).toBe('night');
  });
});
