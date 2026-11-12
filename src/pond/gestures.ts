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
//   chalk       a tick: down, then a longer rise     lift      two straight parts, a corner at the bottom, not straight overall
//   stars       three taps far apart, within 1.5 s   lift      each over 150 px from the others
//   monet       four taps in one place, within 1.8 s lift      all within 44 px of their middle
//
// A stir is at least 50 px across and a rub at most, so they can't both hold; a rim loop is a stir that
// spans the screen; a tick has a corner where a ruled line has none; the taps differ by how far apart.

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
/** A tick: a short stroke down to the right, a corner, and a longer one up to the right. */
export function tick(pts: Pt[]): boolean {
  if (pts.length < 4) return false;
  let c = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[c][1]) c = i;
  if (c === 0 || c === pts.length - 1) return false;
  const a = pts[0],
    b = pts[c],
    z = pts[pts.length - 1],
    l1 = Math.hypot(b[0] - a[0], b[1] - a[1]),
    l2 = Math.hypot(z[0] - b[0], z[1] - b[1]);
  if (b[0] - a[0] < 6 || b[1] - a[1] < 20 || z[0] - b[0] < 30 || b[1] - z[1] < 50 || l2 < 80 || l2 < l1 * 1.4 || l1 > 220) return false;
  const off = (p: Pt, q: Pt, part: Pt[]) => {
    const ch = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return Math.max(...part.map(([x, y]) => Math.abs((q[0] - p[0]) * (p[1] - y) - (p[0] - x) * (q[1] - p[1])) / ch));
  };
  if (off(a, b, pts.slice(0, c + 1)) > Math.max(8, l1 * 0.14) || off(b, z, pts.slice(c)) > Math.max(8, l2 * 0.1)) return false;
  // it never doubles back sideways
  for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[i - 1][0] - 10) return false;
  return true;
}
/** What a stroke means while it is still being drawn. */
export const strokeMoving = (pts: Pt[], W: number, H: number): 'dunhuang' | 'ukiyo' | 'qinghua' | null => (rub(pts) ? 'dunhuang' : loop(pts, W, H));
/** What a stroke means once the finger lifts (a ruled line comes before a tick). */
export const strokeLifted = (pts: Pt[]): 'blueprint' | 'chalk' | null => {
  const ln = straight(pts);
  return ln && ln.chord > 320 ? 'blueprint' : tick(pts) ? 'chalk' : null;
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
