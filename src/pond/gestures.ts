// How a look is found on the water, as rules apart from the pond (engine.js feeds them the pointer):
// which stroke or run of taps means which look. Each gesture has to be meant, and no two may be mistaken
// for each other; gestures.test.ts tries every pair.
//
//   look        gesture                              decided   what sets it apart
//   ink         press and hold still, 1.2 s          timer     no movement past 8 px
//   glow        one tap on the light on the water    lift      a tap, at the light
//   ascii       five letters within 3 s              keys      the keyboard
//   ukiyo       stir once round                      moving    a full turn, wider than 50 px, not round the rim
//   qinghua     once round the rim of the screen     moving    a full turn spanning most of the screen, near its edges
//   dunhuang    rub back and forth over a spot       moving    four reversals along one line, thinner than 50 px
//   blueprint   one long straight line               lift      over 320 px, straight
//   relief      a zigzag of three peaks or more      lift      five sharp corners, travelling one way, wider than a rub
//   stars       three taps far apart, within 1.5 s   lift      each over 150 px from the others
//   monet       four taps in one place, within 1.8 s lift      all within 44 px of their middle
//
// A stir is at least 50 px across and a rub at most, so they can't both hold; a rim loop is a stir that
// spans the screen; a zigzag swings at least 50 px and never turns round, and its corners are sharp, so a
// wavy line is not one; a ruled line has no corner; the taps differ by how far apart.

export type Pt = [number, number];
export interface Tap {
  t: number;
  x: number;
  y: number;
}

const ext = (pts: Pt[]) => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
};
/** The path's length. */
export const lengthOf = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
/** How far the heading has turned along the path, signed: a circle sums to a full turn. */
export function turnOf(all: Pt[]) {
  // steps under 3 px say nothing of the heading (the pond drops them as they come, too)
  const pts = all.filter((p, i) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) >= 3);
  let turn = 0;
  for (let i = 2; i < pts.length; i++) {
    let da = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) - Math.atan2(pts[i - 1][1] - pts[i - 2][1], pts[i - 1][0] - pts[i - 2][0]);
    da = ((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    turn += da;
  }
  return turn;
}
/** A chord, if the path keeps close to the straight line between its ends. */
export function straight(pts: Pt[], len = lengthOf(pts)) {
  if (pts.length < 2) return null;
  const [ax, ay] = pts[0],
    [bx, by] = pts[pts.length - 1],
    chord = Math.hypot(bx - ax, by - ay);
  if (chord < 60 || len > chord * 1.08) return null;
  let off = 0;
  for (const [x, y] of pts) off = Math.max(off, Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / chord);
  return off < Math.max(9, chord * 0.035) ? { chord } : null;
}
/** Once round: a stir (ukiyo-e), or the rim of the screen (青花) when the loop spans it and keeps to its edges. */
export function loop(pts: Pt[], W: number, H: number, turn = turnOf(pts), len = lengthOf(pts)): 'ukiyo' | 'qinghua' | null {
  if (Math.abs(turn) <= Math.PI * 1.9 || len <= 260) return null;
  const e = ext(pts);
  if (Math.min(e.w, e.h) <= 50) return null;
  if (e.w > W * 0.62 && e.h > H * 0.62) {
    const m = Math.max(90, Math.min(W, H) * 0.22),
      near = pts.filter(([x, y]) => Math.min(x, W - x, y, H - y) < m).length;
    if (near >= pts.length * 0.85) return 'qinghua';
  }
  return 'ukiyo';
}
/** Rubbed: back and forth along one line, four reversals at least, each pass 24 px or more, in a thin patch. */
export function rub(pts: Pt[]): boolean {
  if (pts.length < 8) return false;
  const e = ext(pts),
    k = e.w >= e.h ? 0 : 1;
  if (Math.min(e.w, e.h) >= 50 || Math.max(e.w, e.h) < 60 || Math.max(e.w, e.h) > 320) return false;
  let dir = 0,
    turnAt = pts[0][k],
    far = pts[0][k],
    n = 0;
  for (const p of pts) {
    const v = p[k];
    if (dir === 0) {
      if (Math.abs(v - turnAt) >= 24) {
        dir = Math.sign(v - turnAt);
        far = v;
      }
    } else if ((v - far) * dir > 0) far = v;
    else if ((far - v) * dir >= 24) {
      n++;
      dir = -dir;
      turnAt = far;
      far = v;
    }
  }
  return n >= 4;
}
/**
 * A zigzag, as the sign for water is cut: it travels one way, swinging across its way at least five times
 * (three peaks and the two valleys between them, or more), each turn a sharp corner.
 */
export function zigzag(pts: Pt[]): boolean {
  if (pts.length < 12) return false;
  const e = ext(pts),
    k = e.w >= e.h ? 0 : 1,
    j = 1 - k,
    travel = Math.max(e.w, e.h),
    swing = Math.min(e.w, e.h);
  if (travel < 180 || swing < 50) return false;
  // it never doubles back along its way
  const way = Math.sign(pts[pts.length - 1][k] - pts[0][k]);
  let lead = pts[0][k];
  for (const p of pts) {
    if ((p[k] - lead) * way > 0) lead = p[k];
    else if ((lead - p[k]) * way > 24) return false;
  }
  // where it turns across its way: the furthest point of each swing of 30 px or more
  const corners: number[] = [];
  let dir = 0,
    far = 0;
  pts.forEach((p, i) => {
    const v = p[j];
    if (dir === 0) {
      if (Math.abs(v - pts[0][j]) >= 30) {
        dir = Math.sign(v - pts[0][j]);
        far = i;
      }
    } else if ((v - pts[far][j]) * dir > 0) far = i;
    else if ((pts[far][j] - v) * dir >= 30) {
      corners.push(far);
      dir = -dir;
      far = i;
    }
  });
  // a corner is sharp if the heading turns by more than 62° within 16 px either side of it
  const reach = (from: number, step: number): Pt => {
    let d = 0,
      i = from;
    while (i + step >= 0 && i + step < pts.length && d < 16) {
      d += Math.hypot(pts[i + step][0] - pts[i][0], pts[i + step][1] - pts[i][1]);
      i += step;
    }
    return pts[i];
  };
  const sharp = corners.filter((c) => {
    const a = reach(c, -1),
      b = reach(c, 1),
      p = pts[c],
      u = [p[0] - a[0], p[1] - a[1]],
      w = [b[0] - p[0], b[1] - p[1]],
      turn = Math.abs(Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]));
    return turn > 1.08;
  });
  return sharp.length >= 5;
}
/** What a stroke means while it is still being drawn. */
export const strokeMoving = (pts: Pt[], W: number, H: number): 'dunhuang' | 'ukiyo' | 'qinghua' | null => (rub(pts) ? 'dunhuang' : loop(pts, W, H));
/** What a stroke means once the finger lifts. */
export const strokeLifted = (pts: Pt[]): 'blueprint' | 'relief' | null => {
  const ln = straight(pts);
  return ln && ln.chord > 320 ? 'blueprint' : zigzag(pts) ? 'relief' : null;
};
/** What the taps so far mean, the newest last: three far apart (a triangle of stars), or four in one place (dabs of paint). */
export function tapsLook(taps: Tap[]): 'stars' | 'monet' | null {
  const now = taps.length ? taps[taps.length - 1].t : 0,
    three = taps.slice(-3),
    four = taps.slice(-4);
  if (three.length === 3 && now - three[0].t <= 1.5 && three.every((a, i) => three.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) > 150)))
    return 'stars';
  if (four.length === 4 && now - four[0].t <= 1.8) {
    const cx = four.reduce((s, q) => s + q.x, 0) / 4,
      cy = four.reduce((s, q) => s + q.y, 0) / 4;
    if (four.every((q) => Math.hypot(q.x - cx, q.y - cy) <= 44)) return 'monet';
  }
  return null;
}
