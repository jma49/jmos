import { describe, expect, it } from 'vitest';
import { paintingOf, seasonAmounts } from './seasons.js';

const TERMS = '立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒'.split(' ');
// every term looked at where it starts, in its middle and near its end
const within = (i: number) => [i, i + 0.5, i + 0.95].map((y) => seasonAmounts(y));
const season = (i: number) => ['spring', 'summer', 'autumn', 'winter'][Math.floor(i / 6)];

describe('what may appear in which solar term', () => {
  for (const [i, name] of TERMS.entries())
    it(`${name} (${season(i)})`, () => {
      for (const a of within(i)) {
        const s = season(i);
        // plum blossom's season never has lily pads, lotus, dragonflies, petals or falling leaves
        if (s === 'winter') {
          expect(a.lush).toBe(0);
          expect(a.bloom).toBe(0);
          expect(a.flies).toBe(0);
          expect(a.petals).toBe(0);
          expect(a.leaves).toBe(0);
        }
        // spring: petals; the pads small; no lotus in flower, no dragonflies, no falling leaves, no snow
        if (s === 'spring') {
          expect(a.lush).toBeLessThan(0.75);
          expect(a.bloom).toBe(0);
          expect(a.flies).toBe(0);
          expect(a.leaves).toBe(0);
          expect(a.snow).toBe(0);
        }
        // summer: no petals but in its first days, no falling leaves, no ice, no snow
        if (s === 'summer') {
          expect(a.leaves).toBe(0);
          expect(a.ice).toBe(0);
          expect(a.snow).toBe(0);
          expect(a.lush).toBeGreaterThan(0.7);
        }
        // autumn: the lotus is over and withering; no petals, no dragonflies, no snow, no ice
        if (s === 'autumn') {
          expect(a.bloom).toBe(0);
          expect(a.flies).toBe(0);
          expect(a.petals).toBe(0);
          expect(a.snow).toBe(0);
          expect(a.ice).toBe(0);
        }
      }
    });
  it('has each season’s own things in its middle', () => {
    expect(seasonAmounts(3).petals).toBeGreaterThan(0.9);
    expect(seasonAmounts(9.6).bloom).toBeGreaterThan(0.9);
    expect(seasonAmounts(9.2).flies).toBeGreaterThan(0.9);
    expect(seasonAmounts(15).leaves).toBeGreaterThan(0.9);
    expect(seasonAmounts(21.6).snow).toBeGreaterThan(0.9);
    expect(seasonAmounts(22).ice).toBeGreaterThan(0.9);
  });
  it('withers the pads through autumn rather than dropping them: fewer and browner each term, none by 立冬', () => {
    let last = seasonAmounts(12);
    for (let y = 12.5; y <= 18; y += 0.5) {
      const a = seasonAmounts(y);
      expect(a.lush).toBeLessThanOrEqual(last.lush);
      if (y < 18) expect(a.brown).toBeGreaterThanOrEqual(last.brown);
      last = a;
    }
    expect(seasonAmounts(14).lush).toBeGreaterThan(0.2);
    expect(seasonAmounts(17.9).lush).toBeLessThan(0.02);
    expect(seasonAmounts(18).lush).toBe(0);
  });
  it('hangs ink’s painting by the season: willow, lotus, reeds and geese, plum', () => {
    expect(TERMS.map((_, i) => paintingOf(i + 0.5))).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3]);
    // and the plum never hangs over a pad or a lotus
    for (let y = 0; y < 24; y += 0.25) if (paintingOf(y) === 3) expect(seasonAmounts(y).lush + seasonAmounts(y).bloom).toBe(0);
  });
});
