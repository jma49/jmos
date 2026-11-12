import { describe, expect, it } from 'vitest';
import { KOI_SHEETS, MURAL, MURAL_FOOT, MURAL_FOOT_NARROW, RELIEF, muralLayout, reliefLayout } from './newlooks.js';

describe('the Dunhuang wall', () => {
  const walls = [
    [1100, 640],
    [1280, 800],
    [1440, 900],
    [1920, 900],
    [1920, 1080],
    [2000, 1100],
    [2560, 1300],
    [1600, 1400]
  ];
  it('paints nothing under the controls on a wide wall, but the pipa player’s own ribbons', () => {
    for (const [W, H] of walls) {
      const { draw } = muralLayout(W, H, true);
      for (const [name, , , , , , y, , h] of draw) {
        if (name === 'pipa' || name === 'far' || name === 'halo') continue;
        // a figure's paint ends 0.92 of the way down its picture; everything else fills its box
        const foot = y + h * (name === 'flowers' ? 0.92 : 1);
        expect(foot, `${name} on ${W}×${H}`).toBeLessThanOrEqual(H - MURAL_FOOT + 0.5);
      }
    }
  });
  it('keeps the one figure of a narrow wall clear of the controls', () => {
    for (const [W, H] of [
      [390, 844],
      [375, 667],
      [360, 740],
      [430, 932],
      [800, 500],
      [700, 420]
    ]) {
      const { draw } = muralLayout(W, H, false),
        pipa = draw.find((d) => d[0] === 'pipa') ?? [];
      expect(pipa[6] + pipa[8] * 0.83, `${W}×${H}`).toBeLessThanOrEqual(H - MURAL_FOOT_NARROW + 0.5);
      // (and never up over the greeting)
      expect(pipa[6] + pipa[8] * 0.15, `${W}×${H}`).toBeGreaterThanOrEqual(H * 0.35);
    }
  });
  it('keeps every picture it places among the ones it fetches', () => {
    for (const wide of [true, false]) {
      const { draw } = muralLayout(1440, 900, wide);
      for (const [name] of draw) expect(Object.keys(MURAL)).toContain(name);
    }
  });
  it('puts the halo behind the pipa player’s head, drawn before her', () => {
    const { draw, faces } = muralLayout(1440, 900, true),
      halo = draw.find((d) => d[0] === 'halo') ?? [],
      at = draw.findIndex((d) => d[0] === 'halo');
    expect(at).toBeLessThan(draw.findIndex((d) => d[0] === 'pipa'));
    expect(halo[5] + halo[7] / 2).toBeCloseTo(faces[0][0], 3);
    expect(halo[6] + halo[8] / 2).toBeCloseTo(faces[0][1], 3);
    expect(halo[7]).toBeGreaterThan(faces[0][2] * 2);
  });
});

describe('the relief', () => {
  it('carves nothing but the frieze under the controls, on any wall', () => {
    for (const [W, H, wide] of [
      [1100, 640, true],
      [1280, 800, true],
      [1920, 900, true],
      [2560, 1300, true],
      [1600, 1400, true],
      [390, 844, false],
      [375, 667, false],
      [800, 500, false]
    ] as [number, number, boolean][])
      for (const [pair, , , , , x, y, w, h] of reliefLayout(W, H, wide)) {
        if (pair === 'frieze') continue;
        expect(y + h, `${pair} on ${W}×${H}`).toBeLessThanOrEqual(H - (wide ? MURAL_FOOT : MURAL_FOOT_NARROW) + 0.5);
        expect(x + w, `${pair} on ${W}×${H}`).toBeLessThanOrEqual(W + 0.5);
        expect(y, `${pair} on ${W}×${H}`).toBeGreaterThan(wide ? 40 : 26);
      }
  });
  it('keeps the title’s side of a wide wall bare, and has both halves of every pair it places', () => {
    for (const [pair, , , , , x] of reliefLayout(1440, 900, true)) {
      expect(Object.keys(RELIEF)).toContain(`${pair}C`);
      expect(Object.keys(RELIEF)).toContain(`${pair}H`);
      if (pair !== 'frieze') expect(x).toBeGreaterThan(1440 * 0.5);
    }
  });
});

describe('the painted koi', () => {
  it('are sheets to the common measure, each with its mask', () => {
    for (const [look, sh] of Object.entries(KOI_SHEETS)) {
      expect(sh.src, look).toBe(`/pond/${look}/${look === 'monet' ? 'koi-v2' : 'koi'}.webp`);
      expect(sh.mask, look).toBe(`/pond/${look}/koi-mask.webp`);
      expect([sh.rowH, sh.x1, sh.host, sh.you, sh.others], look).toEqual([384, 962, 0, 1, [2, 3]]);
    }
  });
});
