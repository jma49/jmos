import { describe, expect, it } from 'vitest';
import { LANDING, SHEETS, TAKE_OFF, frameAt, doveFrame, lit, spiderFrame } from './sprites.js';

// how many frames each row of each sheet holds (docs/agents/pond.md, "Water")
const DOVE = SHEETS.dove.rows,
  SPIDER = SHEETS.spider.rows;
const TAU = Math.PI * 2;

describe('the dove', () => {
  it('only ever asks for a frame its sheet has', () => {
    for (const state of ['in', 'sit', 'out'])
      for (let t = 0; t < 30; t += 0.07)
        for (const h of [0, 0.1, 0.44, 0.46, 1])
          for (const idle of [false, true]) {
            const [row, i] = doveFrame({ state, t, h, ph: t * 17, idle });
            expect(i).toBeGreaterThanOrEqual(0);
            expect(i).toBeLessThan(DOVE[row]);
          }
  });
  it('takes off through its six frames in order, then beats', () => {
    const seen: number[] = [];
    for (let t = 0; t < TAKE_OFF; t += 0.01) seen.push(doveFrame({ state: 'out', t, h: 0.5, ph: 0 })[1]);
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(doveFrame({ state: 'out', t: TAKE_OFF + 0.01, h: 1, ph: 0 })[0]).toBe(2);
  });
  it('comes down through the landing and folds up on the pad', () => {
    expect(doveFrame({ state: 'in', t: 1, h: 1, ph: 0 })[0]).toBe(2);
    const seen: number[][] = [];
    for (let h = LANDING - 0.001; h >= 0; h -= 0.01) seen.push(doveFrame({ state: 'in', t: 1, h, ph: 0 }));
    expect(seen.every(([row]) => row === 3)).toBe(true);
    expect([...new Set(seen.map(([, i]) => i))]).toEqual([0, 1, 2, 3]);
    expect(doveFrame({ state: 'sit', t: 0.05, h: 0, ph: 0 })).toEqual([3, 4]);
    expect(doveFrame({ state: 'sit', t: 0.2, h: 0, ph: 0 })).toEqual([3, 5]);
    expect(doveFrame({ state: 'sit', t: 0.5, h: 0, ph: 0 })).toEqual([0, 0]);
  });
  it('sits still while it drinks, and looks about after', () => {
    for (let t = 0.3; t < 12; t += 0.1) expect(doveFrame({ state: 'sit', t, h: 0, ph: 0, idle: false })).toEqual([0, 0]);
    const seen = new Set();
    for (let t = 0.3; t < 12; t += 0.1) seen.add(doveFrame({ state: 'sit', t, h: 0, ph: 0, idle: true })[1]);
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('beats once a turn of the phase, every frame in order, widest at the phase’s peak', () => {
    const seen: number[] = [];
    for (let ph = 0; ph < TAU; ph += 0.01) seen.push(doveFrame({ state: 'in', t: 1, h: 1, ph })[1]);
    expect([...new Set(seen)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (let k = 1; k < seen.length; k++) expect((seen[k] - seen[k - 1] + 12) % 12).toBeLessThanOrEqual(1);
    expect([4, 5]).toContain(doveFrame({ state: 'in', t: 1, h: 1, ph: Math.PI / 2 })[1]);
  });
});

describe('the spider', () => {
  it('only ever asks for a frame its sheet has', () => {
    for (const state of ['sit', 'walk', 'crouch', 'jump'])
      for (let t = 0; t < 3; t += 0.05)
        for (const k of [0, 0.3, 0.6, 1])
          for (const alert of [false, true]) {
            const [row, i] = spiderFrame({ state, t, crouch: k, jump: k, gone: t * 3.7 - 1, alert });
            expect(i).toBeGreaterThanOrEqual(0);
            expect(i).toBeLessThan(SPIDER[row]);
          }
  });
  it('walks one loop a stride', () => {
    const seen: number[] = [];
    for (let gone = 2; gone < 3; gone += 0.01) seen.push(spiderFrame({ state: 'walk', t: 0, crouch: 0, jump: 0, gone })[1]);
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('gathers, jumps, lands splayed and settles', () => {
    expect(spiderFrame({ state: 'crouch', t: 0.1, crouch: 0.3, jump: 0 })).toEqual([2, 0]);
    expect(spiderFrame({ state: 'crouch', t: 0.3, crouch: 0.9, jump: 0 })).toEqual([2, 1]);
    expect(spiderFrame({ state: 'jump', t: 0, crouch: 0, jump: 0 })).toEqual([3, 0]);
    expect(spiderFrame({ state: 'jump', t: 0.2, crouch: 0, jump: 0.99 })).toEqual([3, 2]);
    expect(spiderFrame({ state: 'sit', t: 0.05, crouch: 0, jump: 0 })).toEqual([3, 3]);
    expect(spiderFrame({ state: 'sit', t: 1, crouch: 0, jump: 0 })).toEqual([0, 0]);
    expect(spiderFrame({ state: 'sit', t: 1, crouch: 0, jump: 0, alert: true })).toEqual([0, 1]);
  });
});

describe('the sheets', () => {
  it('are on the water look’s folder, in cells that divide the files', () => {
    for (const s of [SHEETS.dove, SHEETS.spider]) for (const f of s.files) expect(f).toMatch(/^\/pond\/water\/\w+-v2-\d\.webp$/);
    expect(4608 % SHEETS.dove.cell).toBe(0);
    expect(3072 % SHEETS.spider.cell).toBe(0);
  });
  it('pack every frame into a cell of its own, six across', () => {
    for (const which of ['dove', 'spider'] as const) {
      const seen = new Set<string>();
      SHEETS[which].rows.forEach((n, row) => {
        for (let i = 0; i < n; i++) {
          const [x, y] = frameAt(which, row, i);
          expect(x).toBeLessThan(6 * SHEETS[which].cell);
          seen.add(`${x} ${y}`);
        }
      });
      expect(seen.size).toBe(SHEETS[which].rows.reduce((a, b) => a + b, 0));
    }
    expect(frameAt('dove', 0, 0)).toEqual([0, 0]);
    expect(frameAt('dove', 2, 1)).toEqual([0, 2 * 384]);
  });
  it('keep their own light on the water and in the print, and nowhere it would fight the look', () => {
    expect(lit('water')).toBe(true);
    expect(lit('ukiyo')).toBe(true);
    expect(lit('monet')).toBe(true);
    for (const look of ['ink', 'glow', 'blueprint', 'ascii', 'stars']) expect(lit(look)).toBe(false);
  });
});
