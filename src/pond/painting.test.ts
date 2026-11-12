import { describe, expect, it } from 'vitest';
import { hang, underPainting } from './hang.js';

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
        expect(x + size).toBeLessThanOrEqual(W + 0.001);
        expect(x + size).toBeGreaterThan(W - 100);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + size).toBeLessThanOrEqual(H);
      }
  });
  it('says what lies under its ink: the right of it, not the empty left third', () => {
    const [x, y, size] = hang(1280, 800, 1);
    expect(underPainting(x + size * 0.7, y + size * 0.5, 1280, 800, 1)).toBe(true);
    expect(underPainting(x + size * 0.2, y + size * 0.5, 1280, 800, 1)).toBe(false);
    expect(underPainting(200, 400, 1280, 800, 1)).toBe(false);
  });
  it('hangs the willow from the top on a wide pond, and keeps every one low on a phone, clear of the type', () => {
    expect(hang(1280, 800, 0)[1]).toBe(0);
    for (let season = 0; season < 4; season++) expect(hang(390, 844, season)[1]).toBeGreaterThan(844 * 0.4);
  });
});
