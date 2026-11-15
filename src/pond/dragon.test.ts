import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRAGONS, dragonHead, dragonScale, dragonSpine, dragonSrc, makeDragon } from './dragon.js';
import { VOLUMES } from './seals';

// ponds: a desktop, a wide one, a small laptop, a phone upright and on its side
const PONDS: [number, number][] = [
  [1280, 800],
  [1920, 1080],
  [1024, 640],
  [390, 844],
  [844, 390]
];
// where a koi may leap: the middle, the corners, and the middle of the circle it winds on to
const starts = (W: number, H: number): [number, number][] => [
  [W / 2, H / 2],
  [40, 40],
  [W - 40, H - 40],
  [40, H - 40],
  [W - 40, 40],
  [W > 860 ? W * 0.66 : W / 2, H * 0.47]
];

describe('the way the dragon goes', () => {
  it('starts where the koi leapt and is gone over the top, tail and all, within a quarter of a minute', () => {
    for (const [W, H] of PONDS)
      for (const [x, y] of starts(W, H)) {
        const d = makeDragon(x, y, W, H);
        expect(d.path[0]).toEqual([x, y]);
        expect(d.time).toBeGreaterThan(5);
        expect(d.time).toBeLessThan(15);
        const spine = dragonSpine(d, d.time, 8 * d.s, 91);
        expect(spine).toHaveLength(91);
        for (const [, sy] of spine) expect(sy).toBeLessThan(0);
      }
  });
  it('leaves by the top only: never off a side or the bottom', () => {
    for (const [W, H] of PONDS)
      for (const [x, y] of starts(W, H))
        for (const [px, py] of makeDragon(x, y, W, H).path) {
          expect(px).toBeGreaterThan(-60);
          expect(px).toBeLessThan(W + 60);
          expect(py).toBeLessThan(H + 60);
        }
  });
  it('is smaller on a small pond', () => {
    expect(dragonScale(390, 844)).toBeLessThan(dragonScale(1280, 800));
    expect(dragonScale(4000, 3000)).toBeLessThanOrEqual(1.15);
  });
});

describe('its spine', () => {
  const d = makeDragon(300, 560, 1280, 800);
  it('comes up out of the water a joint at a time, head first', () => {
    expect(dragonSpine(d, 0, 8, 90)).toHaveLength(1);
    const early = dragonSpine(d, 0.8, 8, 90),
      later = dragonSpine(d, 4, 8, 90);
    expect(early.length).toBeGreaterThan(1);
    expect(early.length).toBeLessThan(90);
    expect(later).toHaveLength(90);
    expect(later[0]).toEqual(dragonHead(d, 4));
  });
  it('has its joints evenly along the way it went, never further apart than asked', () => {
    const spine = dragonSpine(d, 4, 8, 90);
    for (let i = 1; i < spine.length; i++) {
      const gap = Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]);
      expect(gap).toBeLessThanOrEqual(8.01);
      expect(gap).toBeGreaterThan(6);
    }
  });
});

describe('its pictures', () => {
  type Listed = string | { src: string; height: string };
  const table = DRAGONS as Record<string, Listed>;
  it("are in the site, each one listed (the relief's with its height)", () => {
    for (const d of Object.values(table)) for (const src of typeof d === 'string' ? [d] : [d.src, d.height]) expect(existsSync(`public${src}`), src).toBe(true);
  });
  it("serve a look that paints its own koi only when it has its own; the water's serves the rest", () => {
    expect(dragonSrc('ink', false)).toBe(table.water);
    expect(dragonSrc('glow', false)).toBe(table.water);
    expect(dragonSrc('ukiyo', true)).toBe(table.ukiyo);
    expect(dragonSrc('a look still to come', true)).toBeUndefined();
  });
  it('and its seal is a preview for as long as the water has no dragon', () => {
    const seal = VOLUMES.flatMap((v) => v.seals).find((s) => s.id === 'dragon');
    expect(!!seal?.preview).toBe(!table.water);
  });
});
