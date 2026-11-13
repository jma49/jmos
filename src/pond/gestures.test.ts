import { describe, expect, it } from 'vitest';
import { type Pt, type Tap, loop, rub, straight, strokeLifted, strokeMoving, tapsLook, zigzag } from './gestures';

const W = 1280,
  H = 800;
// the strokes, as a hand makes them: a little unsteady, a point every few pixels
const wob = (i: number) => Math.sin(i * 1.7) * 1.5;
const line = (a: Pt, b: Pt, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n + wob(i), a[1] + ((b[1] - a[1]) * i) / n + wob(i + 3)] as Pt);
const circle = (cx: number, cy: number, r: number, turns = 1.05, n = 80): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * turns * Math.PI * 2) * r, cy + Math.sin((i / n) * turns * Math.PI * 2) * r] as Pt);
// the corners rounded, as a finger takes them
const rim = (m = 50, w = W, h = H): Pt[] => {
  const r = 40,
    out: Pt[] = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) out.push([cx + Math.cos(a0 + (i / 8) * (Math.PI / 2)) * r, cy + Math.sin(a0 + (i / 8) * (Math.PI / 2)) * r]);
  };
  out.push(...line([m + r, m], [w - m - r, m]));
  arc(w - m - r, m + r, -Math.PI / 2);
  out.push(...line([w - m, m + r], [w - m, h - m - r]).slice(1));
  arc(w - m - r, h - m - r, 0);
  out.push(...line([w - m - r, h - m], [m + r, h - m]).slice(1));
  arc(m + r, h - m - r, Math.PI / 2);
  out.push(...line([m, h - m - r], [m, m + r]).slice(1));
  arc(m + r, m + r, Math.PI);
  out.push(...line([m + r, m], [m + r + 120, m], 8).slice(1));
  return out;
};
const rubbing = (x: number, y: number, w = 120, passes = 6): Pt[] =>
  Array.from({ length: passes }, (_, k) => line(k % 2 ? [x + w, y + k * 2] : [x, y + k * 2], k % 2 ? [x, y + k * 2 + 2] : [x + w, y + k * 2 + 2], 12)).flat();
const zigzagging = (x: number, y: number, legs = 7, pitch = 50, swing = 70): Pt[] =>
  Array.from({ length: legs }, (_, k) => line([x + k * pitch, y + (k % 2 ? -swing : 0)], [x + (k + 1) * pitch, y + (k % 2 ? 0 : -swing)], 10)).flat();
const ruled = (): Pt[] => line([300, 500], [760, 380], 60);
const taps = (pts: Pt[], gap = 0.3): Tap[] => pts.map(([x, y], i) => ({ t: 10 + i * gap, x, y }));

const strokes: Record<string, Pt[]> = {
  ukiyo: circle(700, 400, 90),
  qinghua: rim(),
  dunhuang: rubbing(600, 400),
  blueprint: ruled(),
  relief: zigzagging(420, 430)
};
/** Everything a stroke could be taken for, while it moves and when it lifts. */
const read = (pts: Pt[]) => {
  const found = new Set<string>();
  for (let n = 3; n <= pts.length; n++) {
    const m = strokeMoving(pts.slice(0, n), W, H);
    if (m) {
      found.add(m);
      return found; // the look comes in, and the stroke is over
    }
  }
  const l = strokeLifted(pts);
  if (l) found.add(l);
  return found;
};

describe('each stroke means its own look and no other', () => {
  for (const [name, pts] of Object.entries(strokes))
    it(name, () => {
      expect([...read(pts)]).toEqual([name]);
    });
  it('on a phone as well', () => {
    const w = 390,
      h = 844,
      phoneRim = rim(34, w, h);
    expect(loop(phoneRim, w, h)).toBe('qinghua');
    expect(loop(circle(200, 500, 70), w, h)).toBe('ukiyo');
    expect(rub(rubbing(120, 500, 100))).toBe(true);
    expect(zigzag(zigzagging(60, 520, 7, 36, 60))).toBe(true);
  });
});

describe('every pair: one stroke is never read as another', () => {
  const tests: Record<string, (p: Pt[]) => boolean> = {
    ukiyo: (p) => loop(p, W, H) === 'ukiyo',
    qinghua: (p) => loop(p, W, H) === 'qinghua',
    dunhuang: (p) => rub(p),
    blueprint: (p) => (straight(p)?.chord ?? 0) > 320,
    relief: (p) => strokeLifted(p) === 'relief'
  };
  for (const made of Object.keys(strokes))
    for (const asked of Object.keys(tests))
      it(`${made} ${made === asked ? 'is' : 'is not'} ${asked}`, () => {
        expect(tests[asked](strokes[made])).toBe(made === asked);
      });
});

describe('strokes that are none of them', () => {
  it('a short drag, a wavy line, a big circle in the middle, a half circle, a V', () => {
    expect(read(line([400, 400], [520, 430])).size).toBe(0);
    expect(read(Array.from({ length: 60 }, (_, i) => [300 + i * 8, 400 + Math.sin(i / 4) * 60] as Pt)).size).toBe(0);
    expect([...read(circle(640, 400, 200))]).toEqual(['ukiyo']);
    expect(read(circle(640, 400, 120, 0.5)).size).toBe(0);
    // a zigzag of two peaks is one short, and one drawn up and down is still a zigzag
    expect(zigzag(zigzagging(420, 430, 4))).toBe(false);
    expect(zigzag(zigzagging(420, 430).map(([x, y]) => [y + 100, x] as Pt))).toBe(true);
  });
  it('two passes are not a rub, and a wide scribble is not one', () => {
    expect(rub(rubbing(600, 400, 120, 3))).toBe(false);
    expect(
      rub([
        ...line([300, 300], [700, 380]),
        ...line([700, 380], [300, 460]),
        ...line([300, 460], [700, 540]),
        ...line([700, 540], [300, 620]),
        ...line([300, 620], [700, 700])
      ])
    ).toBe(false);
  });
});

describe('a hand on a large screen', () => {
  // a rub half a screen long that wanders as it goes: each pass 30 px below the last
  const wide = Array.from({ length: 6 }, (_, k) =>
    line(k % 2 ? [900, 400 + k * 12] : [400, 400 + k * 12], k % 2 ? [400, 412 + k * 12] : [900, 412 + k * 12], 30)
  ).flat();
  it('rubs wide and not quite on one line, and it is still a rub, not a stir', () => {
    expect(rub(wide)).toBe(true);
    // (it is a rub the moment it is anything: at no point on its way is it a stir)
    expect([...read(wide)]).toEqual(['dunhuang']);
  });
  it('draws a zigzag large, shallow and with its corners rounded', () => {
    expect(zigzag(zigzagging(200, 500, 7, 110, 70))).toBe(true);
    const round: Pt[] = Array.from({ length: 7 * 24 + 1 }, (_, i) => {
      const u = i / 24,
        tri = Math.abs((u % 2) - 1) * 2 - 1;
      return [200 + u * 90, 500 + 80 * (tri * 0.6 + Math.sin(u * Math.PI + Math.PI / 2) * 0.4)];
    });
    expect(zigzag(round)).toBe(true);
    expect([...read(round)]).toEqual(['relief']);
  });
});

describe('on a slant', () => {
  const turned = (pts: Pt[], deg: number, cx = 640, cy = 400): Pt[] => {
    const c = Math.cos((deg * Math.PI) / 180),
      sn = Math.sin((deg * Math.PI) / 180);
    return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]);
  };
  it('a rub is a rub at any angle, and never a stir', () => {
    for (const deg of [20, 45, 70, 110, 135])
      for (const w of [120, 300]) {
        const pts = turned(rubbing(560, 400, w, 6), deg);
        expect(rub(pts)).toBe(true);
        expect([...read(pts)]).toEqual(['dunhuang']);
      }
  });
  it('a small quick scrub is a rub too', () => {
    expect(rub(turned(rubbing(620, 400, 50, 8), 30))).toBe(true);
  });
  it('a zigzag is a zigzag at any angle', () => {
    for (const deg of [25, 45, 60, 120]) {
      const pts = turned(zigzagging(420, 430), deg);
      expect(zigzag(pts)).toBe(true);
      expect([...read(pts)]).toEqual(['relief']);
    }
  });
  it('a slanted ruled line is still only a line, and a circle still a stir', () => {
    expect([...read(turned(ruled(), 40))]).toEqual(['blueprint']);
    expect([...read(circle(640, 400, 90))]).toEqual(['ukiyo']);
  });
});

describe('dust brushed off a stroke at a time', () => {
  it('four strokes the same way, joined end to end, are a rub; two are not', () => {
    const swipe = (k: number): Pt[] => line([500, 400 + k * 8], [760, 404 + k * 8], 14);
    expect(rub([0, 1, 2, 3].flatMap(swipe))).toBe(true);
    expect(rub([0, 1].flatMap(swipe))).toBe(false);
  });
});

describe('taps', () => {
  const far = taps([
    [300, 300],
    [700, 250],
    [520, 600]
  ]);
  const dabs = taps([
    [600, 400],
    [612, 392],
    [596, 410],
    [606, 404]
  ]);
  it('three far apart are stars, four in one place are dabs of paint, and neither is the other', () => {
    expect(tapsLook(far)).toBe('stars');
    expect(tapsLook(dabs)).toBe('monet');
    expect(tapsLook(dabs.slice(0, 3))).toBe(null);
    expect(tapsLook(far.slice(0, 2))).toBe(null);
  });
  it('five in a row are letters typed with a finger, and nothing else', () => {
    const row = (x: number, y: number, step: number): Pt[] => [0, 1, 2, 3, 4].map((i) => [x + i * step, y + (i % 2) * 8]);
    expect(tapsLook(taps(row(200, 500, 60)))).toBe('ascii');
    expect(tapsLook(taps(row(600, 500, -60)))).toBe('ascii');
    // four of them are not yet anything; steps as far apart as stars are stars; all in one place are dabs
    expect(tapsLook(taps(row(200, 500, 60).slice(0, 4)))).toBe(null);
    expect(tapsLook(taps(row(200, 500, 170)))).not.toBe('ascii');
    expect(tapsLook(taps(row(200, 500, 6)))).not.toBe('ascii');
    // too slow, or wandering up and down
    expect(tapsLook(taps(row(200, 500, 60), 0.9))).toBe(null);
    expect(tapsLook(taps([0, 1, 2, 3, 4].map((i) => [200 + i * 60, 500 + i * 30] as Pt)))).toBe(null);
  });
  it('one press, or two, is only feeding', () => {
    expect(tapsLook(taps([[500, 500]]))).toBe(null);
    expect(
      tapsLook(
        taps([
          [500, 500],
          [900, 300]
        ])
      )
    ).toBe(null);
  });
  it('slow taps, or taps neither close nor far, mean nothing', () => {
    expect(tapsLook(far.map((q, i) => ({ ...q, t: 10 + i })))).toBe(null);
    expect(tapsLook(dabs.map((q, i) => ({ ...q, t: 10 + i * 0.8 })))).toBe(null);
    expect(
      tapsLook(
        taps([
          [500, 500],
          [580, 500],
          [540, 570],
          [500, 500]
        ])
      )
    ).toBe(null);
  });
  it('dabs after far taps, and far taps after dabs, are each read alone', () => {
    expect(tapsLook([...far.slice(0, 2), ...dabs.map((q) => ({ ...q, t: q.t + 1 }))])).toBe('monet');
  });
});
