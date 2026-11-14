// 鲤鱼跃龙门: the koi that cleared the Dragon Gate, as a dragon. Its picture is a painting, as a look's koi
// are: a straight dragon seen from above, cut into slices along its length, each laid along the way its head
// has gone, so it winds as it goes. It is drawn on the fish's layer, so the looks that draw the pond's own
// koi restyle it as they do them: washed in ink, outlined and hatched on the blueprint, typed in ASCII.

/**
 * Each look's dragon (public/pond/<look>/), once its picture has come. The water's also serves the looks
 * that draw the pond's own koi; a look that paints its koi has a dragon only with its own picture. None has
 * come yet, so no dragon rises: what is wanted is under "The dragon sheet" in docs/agents/pond.md.
 */
export const DRAGONS = {};
/** The picture `look`'s dragon is drawn from, if it has one; `own` is whether the look paints its own koi. */
export const dragonSrc = (look, own) => DRAGONS[look] ?? (own ? undefined : DRAGONS.water);
// the sheet: 2048 x 512, its spine along the middle, from the tip of the snout at x 64 to the tail's at x 1984
const SHEET = { h: 512, x0: 64, x1: 1984 };

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (x) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

// its length on a pond 800 px across
const LONG = 720;
/** How large it is drawn on a pond W by H: a small pond has a small dragon. */
export const dragonScale = (W, H) => clamp(Math.min(W, H) / 800, 0.55, 1.15);

/**
 * The dragon that rises from (x0, y0) on a pond W by H: the way its head goes, a point every 1/60 s, and how
 * far along it each point is. It winds on to a wide circle over the open water and goes once round, snaking,
 * then turns up and climbs away, faster, until the last of its tail has left over the top. `time` is how
 * long that takes.
 */
export function makeDragon(x0, y0, W, H) {
  const s = dragonScale(W, H),
    wide = W > 860,
    cx = wide ? W * 0.66 : W / 2,
    cy = H * 0.47,
    R = wide ? Math.min(W * 0.2, H * 0.3) : Math.min(W, H) * 0.3,
    dir = x0 > cx ? -1 : 1,
    dt = 1 / 60,
    path = [[x0, y0]],
    cum = [0];
  let x = x0,
    y = y0,
    h = -Math.PI / 2,
    la = Math.atan2(y0 - cy, x0 - cx),
    swept = 0,
    out = -1,
    far = 0;
  for (let i = 1; i < 60 * 18; i++) {
    const t = i * dt,
      rx = x - cx,
      ry = y - cy,
      r = Math.hypot(rx, ry) || 1;
    // the way it wants to go: round the circle and back on to it, or, once round, up and away, drawing in
    // over the circle's middle as it climbs so it never leaves by a side
    let wx = clamp((cx - x) / 200, -0.3, 0.3),
      wy = -1;
    if (out < 0) {
      const pull = clamp((R - r) / R, -1, 1) * 1.5;
      wx = (-ry * dir + rx * pull) / r;
      wy = (rx * dir + ry * pull) / r;
      let d = Math.atan2(ry, rx) - la;
      d -= Math.round(d / TAU) * TAU;
      la += d;
      if (r > R * 0.5) swept += d * dir;
      if (swept > TAU * 1.05 || t > 9) out = t;
    }
    let turn = Math.atan2(wy, wx) - h;
    turn -= Math.round(turn / TAU) * TAU;
    h += clamp(turn, -2.6 * dt, 2.6 * dt);
    // it comes up slowly and leaves fast; its heading swings from side to side as a snake's does
    const v = 300 * s * (0.3 + 0.7 * ease(t / 1.2)) * (out < 0 ? 1 : 1 + 1.7 * ease((t - out) / 1.5)),
      a = h + 0.5 * Math.sin((far / (190 * s)) * TAU);
    x += Math.cos(a) * v * dt;
    y += Math.sin(a) * v * dt;
    far += v * dt;
    path.push([x, y]);
    cum.push(far);
    if (out >= 0 && y < -(LONG + 110) * s) break;
  }
  return { path, cum, s, time: (path.length - 1) / 60 };
}

/** Its spine t seconds after it rose, head first, a joint every `ds` px: only as much of it as has come up. */
export function dragonSpine(d, t, ds, n) {
  const { path, cum } = d,
    f = clamp(t * 60, 0, path.length - 1),
    i = Math.min(Math.floor(f), path.length - 2),
    head = cum[i] + (cum[i + 1] - cum[i]) * (f - i),
    P = [];
  let j = i;
  for (let k = 0; k < n; k++) {
    const at = head - k * ds;
    if (at < 0) break;
    while (j > 0 && cum[j] > at) j--;
    const q = (at - cum[j]) / (cum[j + 1] - cum[j] || 1);
    P.push([path[j][0] + (path[j + 1][0] - path[j][0]) * q, path[j][1] + (path[j + 1][1] - path[j][1]) * q]);
  }
  return P;
}

/** Where its head is t seconds after it rose. */
export const dragonHead = (d, t) => dragonSpine(d, t, 1, 1)[0];

/**
 * Which copy of its sheet to draw it from, where the canvas has `px` pixels to one of the pond's: the half-size
 * one where it is drawn small, so fine lines don't shimmer.
 */
export const dragonCopy = (d, px) => (((LONG * d.s) / (SHEET.x1 - SHEET.x0)) * px < 0.3 ? 0.5 : 1);

/**
 * The dragon t seconds after it rose, on the 2D context `c` (in the pond's own px), from `pic`: its sheet, or
 * a copy of it at `m` of its size. Only as much of it is drawn as has come up out of the water.
 */
export function drawDragon(c, d, t, pic, m = 1) {
  const n = 120,
    len = LONG * d.s,
    span = SHEET.x1 - SHEET.x0,
    h = (SHEET.h * len) / span,
    P = dragonSpine(d, t, len / n, n + 1);
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i],
      [x1, y1] = P[i + 1];
    c.save();
    c.translate(x0, y0);
    c.rotate(Math.atan2(y1 - y0, x1 - x0));
    c.drawImage(pic, (SHEET.x0 + (span * i) / n) * m, 0, (span / n + 1.5) * m, SHEET.h * m, -0.4, -h / 2, Math.hypot(x1 - x0, y1 - y0) + 1.2, h);
    c.restore();
  }
}

/** On the star chart it is a constellation over its figure, as the koi are: stars down its back, joined. */
export function drawDragonStars(c, d, t) {
  const P = dragonSpine(d, t, 56 * d.s, 14),
    col = '255,214,140';
  if (P.length < 2) return;
  c.save();
  c.strokeStyle = `rgba(${col},0.5)`;
  c.lineWidth = 0.9;
  c.beginPath();
  P.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  P.forEach(([x, y], k) => {
    const r = (k === 0 ? 3.2 : k % 2 ? 1.6 : 2.2) * d.s + 0.6;
    for (const [q, fill] of [
      [r * 2.6, `rgba(${col},0.16)`],
      [r, `rgb(${col})`]
    ]) {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(x, y, q, 0, TAU);
      c.fill();
    }
  });
  c.restore();
}
