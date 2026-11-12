import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain script, no types
import { hang } from './painting.js';

describe("where a season's painting hangs", () => {
  it('is flush with the right edge and inside the pond, at every size', () => {
    for (const [W, H] of [
      [1280, 800],
      [2000, 1125],
      [960, 600],
      [390, 844]
    ])
      for (let season = 0; season < 4; season++) {
        const [x, y, size] = hang(W, H, season);
        expect(x + size).toBeCloseTo(W);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + size).toBeLessThanOrEqual(H);
      }
  });
  it('hangs the willow from the top on a wide pond, and keeps every one low on a phone, clear of the type', () => {
    expect(hang(1280, 800, 0)[1]).toBe(0);
    for (let season = 0; season < 4; season++) expect(hang(390, 844, season)[1]).toBeGreaterThan(844 * 0.4);
  });
});
