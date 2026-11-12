// The ink look as a hanging painting of the pond: a seasonal motif drawn in brush strokes at one edge
// (willow in spring, lotus in summer, reeds and geese in autumn, plum in winter), pale distant hills
// along the foot, and the centre and the title page left empty (留白). Drawn once per season and size
// into a canvas that the page lays over the water, multiplied, only in ink.
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// a stroke of the brush along a path: tapering, then a few dry passes that break up along it
function stroke(c, pts, w0, w1, rgb, a, dry = 0.5) {
  const seg = (o, alpha, dash) => {
    c.setLineDash(dash || []);
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1),
        [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i],
        nx = -(y1 - y0),
        ny = x1 - x0,
        l = Math.hypot(nx, ny) || 1;
      c.lineWidth = Math.max(0.3, w0 + (w1 - w0) * t);
      c.strokeStyle = `rgba(${rgb},${alpha})`;
      c.beginPath();
      c.moveTo(x0 + (nx / l) * o, y0 + (ny / l) * o);
      c.lineTo(x1 + (nx / l) * o, y1 + (ny / l) * o);
      c.stroke();
    }
  };
  c.lineCap = 'round';
  seg(0, a);
  for (let k = 0; k < 3; k++) seg(rnd(-0.35, 0.35) * w0, a * dry * 0.5, [rnd(3, 14), rnd(1, 5)]);
  c.setLineDash([]);
}
// a curve sampled as points: from p0 through a control point to p1
function curve(p0, q, p1, n = 18) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * q[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * q[1] + t * t * p1[1]]);
  }
  return out;
}
// a soft wash: a blot with a broken edge, darker at its heart
function wash(c, x, y, r, rgb, a, squash = 1, rot = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(1, squash);
  for (let k = 0; k < 3; k++) {
    const rr = r * (1 - k * 0.22);
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * TAU,
        q = rr * (1 + 0.08 * Math.sin(t * 5 + k) + rnd(-0.05, 0.05));
      c.lineTo(Math.cos(t) * q, Math.sin(t) * q);
    }
    c.fillStyle = `rgba(${rgb},${a * (0.45 + k * 0.25)})`;
    c.fill();
  }
  c.restore();
}
const INK = '28,25,22',
  GREY = '70,72,66';

function hills(c, W, H, s) {
  c.save();
  c.filter = `blur(${Math.round(5 * s)}px)`;
  for (const [y0, amp, a, x0] of [
    [H * 0.93, 70 * s, 0.07, W * 0.38],
    [H * 0.97, 46 * s, 0.1, W * 0.5]
  ]) {
    c.beginPath();
    c.moveTo(x0, H);
    for (let x = x0; x <= W + 20; x += 8) c.lineTo(x, y0 - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + y0) * Math.sin(x * 0.0021 + 1.3)));
    c.lineTo(W + 20, H);
    c.fillStyle = `rgba(${GREY},${a})`;
    c.fill();
  }
  c.restore();
}
function willow(c, W, H, s) {
  for (let i = 0; i < 9; i++) {
    const x = W * rnd(0.6, 0.93),
      len = H * rnd(0.18, 0.42) * s,
      sway = rnd(-30, 30) * s,
      pts = curve([x, -10], [x + sway, len * 0.5], [x + sway * 0.4, len]);
    stroke(c, pts, 1.4 * s, 0.5 * s, INK, 0.45, 0.4);
    for (let j = 3; j < pts.length; j += 1) {
      const [px, py] = pts[j],
        side = j % 2 ? 1 : -1;
      c.save();
      c.translate(px, py);
      c.rotate(side * rnd(0.5, 0.9) + Math.PI / 2);
      c.beginPath();
      c.ellipse(0, side * 5 * s, 1.6 * s, 6 * s, 0, 0, TAU);
      c.fillStyle = `rgba(60,72,52,${rnd(0.25, 0.45)})`;
      c.fill();
      c.restore();
    }
  }
}
function lotus(c, W, H, s) {
  const base = [W * 0.86, H + 10];
  const leaves = [
    [W * 0.78, H * 0.78, 70],
    [W * 0.93, H * 0.66, 92],
    [W * 0.7, H * 0.9, 54]
  ];
  for (const [x, y, r] of leaves) {
    stroke(c, curve(base, [(base[0] + x) / 2 + 20 * s, (base[1] + y) / 2], [x, y]), 2.4 * s, 1.6 * s, INK, 0.5, 0.5);
    wash(c, x, y, r * s, INK, 0.16, 0.42, rnd(-0.3, 0.3));
    for (let v = 0; v < 9; v++) {
      const t = (v / 9) * TAU;
      stroke(
        c,
        [
          [x, y],
          [x + Math.cos(t) * r * s * 0.9, y + Math.sin(t) * r * s * 0.38]
        ],
        0.8 * s,
        0.3 * s,
        INK,
        0.25,
        0.8
      );
    }
  }
  // one flower and one bud, in rouge
  const fx = W * 0.84,
    fy = H * 0.52;
  stroke(c, curve(base, [W * 0.88, H * 0.75], [fx, fy + 24 * s]), 2 * s, 1.4 * s, INK, 0.55);
  for (let p = 0; p < 6; p++) {
    const a = -Math.PI / 2 + (p - 2.5) * 0.42;
    c.save();
    c.translate(fx, fy + 18 * s);
    c.rotate(a + Math.PI / 2);
    c.beginPath();
    c.ellipse(0, -20 * s, 9 * s, 22 * s, 0, 0, TAU);
    const g = c.createLinearGradient(0, 0, 0, -40 * s);
    g.addColorStop(0, 'rgba(226,170,176,0.35)');
    g.addColorStop(1, 'rgba(196,84,100,0.7)');
    c.fillStyle = g;
    c.fill();
    c.restore();
  }
  stroke(c, curve(base, [W * 0.8, H * 0.7], [W * 0.75, H * 0.6]), 1.6 * s, 1.1 * s, INK, 0.5);
  wash(c, W * 0.75, H * 0.6 - 10 * s, 10 * s, '196,84,100', 0.55, 1.6);
}
function reeds(c, W, H, s) {
  for (let i = 0; i < 12; i++) {
    const x = W * rnd(0.72, 0.98),
      top = H * rnd(0.5, 0.72),
      bend = rnd(-60, -20) * s,
      pts = curve([x, H + 6], [x + bend * 0.2, (H + top) / 2], [x + bend, top]);
    stroke(c, pts, 1.6 * s, 0.6 * s, INK, 0.5, 0.5);
    const [tx, ty] = pts[pts.length - 1];
    for (let f = 0; f < 7; f++)
      stroke(
        c,
        [
          [tx, ty + f * 3 * s],
          [tx + bend * 0.25 + rnd(-6, 6) * s, ty + f * 3 * s + 10 * s]
        ],
        1.2 * s,
        0.2 * s,
        '120,100,80',
        0.35,
        0.8
      );
    if (i % 3 === 0) stroke(c, curve([x, H * 0.95], [x - 30 * s, H * 0.86], [x - 60 * s, H * 0.9]), 2 * s, 0.3 * s, INK, 0.35, 0.6);
  }
  // wild geese, far off, in a long skein
  for (let g = 0; g < 7; g++) {
    const x = W * 0.62 + g * 26 * s,
      y = H * 0.16 + g * 9 * s + (g % 2) * 4 * s,
      w = 7 * s;
    stroke(
      c,
      [
        [x - w, y - w * 0.4],
        [x, y],
        [x + w, y - w * 0.5]
      ],
      1.1 * s,
      0.6 * s,
      INK,
      0.5,
      0.2
    );
  }
}
function plum(c, W, H, s) {
  const pts = curve([W + 10, H * 0.34], [W * 0.86, H * 0.2], [W * 0.68, H * 0.3], 22);
  stroke(c, pts, 9 * s, 3 * s, INK, 0.7, 0.7);
  const twigs = [];
  for (const k of [5, 10, 15, 19]) {
    const [x, y] = pts[k],
      e = [x + rnd(-50, 20) * s, y + rnd(-70, 40) * s];
    stroke(c, curve([x, y], [(x + e[0]) / 2 + 10 * s, (y + e[1]) / 2 - 10 * s], e, 8), 3 * s, 0.8 * s, INK, 0.65, 0.6);
    twigs.push(e, [(x + e[0]) / 2, (y + e[1]) / 2]);
  }
  // snow on the branch, paper left white
  for (let i = 3; i < pts.length - 2; i += 3) wash(c, pts[i][0], pts[i][1] - 4 * s, 6 * s, '250,248,240', 0.9, 0.45);
  // blossoms: five petals in red, dark dots at the heart
  for (const [x, y] of [...twigs, pts[8], pts[13], pts[17]]) {
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      c.beginPath();
      c.arc(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s, 3.4 * s, 0, TAU);
      c.fillStyle = 'rgba(190,40,42,0.7)';
      c.fill();
    }
    c.beginPath();
    c.arc(x, y, 1.4 * s, 0, TAU);
    c.fillStyle = 'rgba(40,20,16,0.8)';
    c.fill();
  }
}
const MOTIF = [willow, lotus, reeds, plum];

/** Paints the season's picture (0 spring … 3 winter) into a canvas of the pond's size. */
export function paint(cv, W, H, season) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    s = Math.min(1, Math.max(0.55, W / 1280));
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  hills(c, W, H, s);
  MOTIF[season](c, W, H, s);
}
