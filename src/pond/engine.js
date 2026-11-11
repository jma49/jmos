// The pond: a full-bleed pond seen from above, its title page and its
// chapters (src/pages/pond.astro has the markup and the build-time data).
// The water is a height field stepped on the CPU, drawn with WebGL2 with
// the koi, lily pads and what floats; the glass panes over it are drawn in
// the same pass, from the panes' places on the page each frame. It follows
// the year by the 24 solar terms and the day by the visitor's clock.
//
// Plain JavaScript, as the prototype it was ported from; the parts that
// reach the rest of the site (music.ts, people.ts, content.ts) are typed.
// docs/agents/pond.md has the map.

import { report } from '../os/core/report';
import { load, save } from '../os/core/storage';
import { SocialError } from '../os/social/errors';
import { coverOf, loadSongs, music, onMusic, play as playSongAt, setMusicMuted, toggle as toggleSong } from './music';
import * as people from './people';

const $ = (s) => document.querySelector(s);
/** What the page gathered at build time: the timeline, the photos, the About chapter. */
const D = JSON.parse($('#pond-data').textContent);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const pond = $('#pond'),
  glc = $('#gl');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let W = 1,
  H = 1,
  big = true,
  T = 0;

/* ================= the water: a height field stepped on the CPU ================= */
let GW = 0,
  GH = 0,
  hA,
  vA;
function initSim() {
  GW = big ? 232 : 132;
  GH = Math.max(40, Math.round((GW * H) / W));
  hA = new Float32Array(GW * GH);
  vA = new Float32Array(GW * GH);
}
function drop(x, y, r, a) {
  const cx = (x / W) * GW,
    cy = (y / H) * GH,
    R = Math.ceil(r * 2.6),
    rr = r * r;
  for (let j = Math.max(1, (cy - R) | 0); j <= Math.min(GH - 2, (cy + R) | 0); j++)
    for (let i = Math.max(1, (cx - R) | 0); i <= Math.min(GW - 2, (cx + R) | 0); i++) {
      const d2 = (i - cx) * (i - cx) + (j - cy) * (j - cy);
      hA[j * GW + i] += a * Math.exp(-d2 / rr) * (1 - iceM[j * GW + i]);
    }
}
function stepSim() {
  for (let j = 1; j < GH - 1; j++) {
    let k = j * GW + 1;
    for (let i = 1; i < GW - 1; i++, k++) {
      const lap = hA[k - 1] + hA[k + 1] + hA[k - GW] + hA[k + GW] - 4 * hA[k];
      vA[k] = (vA[k] + lap * 0.27) * 0.988 * (1 - 0.92 * iceM[k]);
    }
  }
  for (let k = 0, n = GW * GH; k < n; k++) hA[k] += vA[k];
  for (let i = 0; i < GW; i++) {
    hA[i] = hA[i + GW];
    hA[(GH - 1) * GW + i] = hA[(GH - 2) * GW + i];
  }
  for (let j = 0; j < GH; j++) {
    hA[j * GW] = hA[j * GW + 1];
    hA[j * GW + GW - 1] = hA[j * GW + GW - 2];
  }
}
function slopeAt(x, y) {
  const i = clamp(((x / W) * GW) | 0, 1, GW - 2),
    j = clamp(((y / H) * GH) | 0, 1, GH - 2),
    k = j * GW + i;
  return [hA[k + 1] - hA[k - 1], hA[k + GW] - hA[k - GW], hA[k]];
}

/* ================= koi ================= */
const N = 12;
const fishCv = document.createElement('canvas'),
  fctx = fishCv.getContext('2d');
class Koi {
  constructor(o) {
    Object.assign(this, { burst: 0, sp: 0, w: 0, ph: rnd(0, 6), seed: rnd(0, 9), depth: 0.1, tail: 1, alpha: 0, next: 0, wake: 0, shown: true }, o);
    this.tx = this.x;
    this.ty = this.y;
    this.jit = this.patches.map(() => [rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]);
    this.spine = Array.from({ length: N }, (_, i) => ({
      x: this.x - Math.cos(this.a) * i * this.size * 0.1,
      y: this.y - Math.sin(this.a) * i * this.size * 0.1
    }));
  }
  // Where to next: somewhere ahead rather than behind, so the way there is an arc and not an about-turn.
  wander() {
    let best = null,
      low = 9;
    for (let k = 0; k < 7; k++) {
      const x = rnd(70, W - 70),
        y = rnd(80, H - 80);
      if (Math.hypot(x - this.x, y - this.y) < 170) continue;
      let da = Math.atan2(y - this.y, x - this.x) - this.a;
      da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      const score = da + Math.random() * 0.7;
      if (score < low) {
        low = score;
        best = [x, y];
      }
    }
    if (!best) best = [rnd(70, W - 70), rnd(80, H - 80)];
    this.tx = best[0];
    this.ty = best[1];
    this.next = T + rnd(5, 10);
  }
  update(dt) {
    if (this.mode === 'wander' && (T > this.next || Math.hypot(this.tx - this.x, this.ty - this.y) < 110)) this.wander();
    // Round the pointer, not at it: the point made for is always a little further along a circle about it.
    if (this.mode === 'you' || this.mode === 'visit') {
      const R = this.mode === 'you' ? 74 : 124,
        ang = Math.atan2(this.y - ptr.y, this.x - ptr.x) + (this.mode === 'you' ? 0.9 : -0.9);
      this.tx = ptr.x + Math.cos(ang) * R;
      this.ty = ptr.y + Math.sin(ang) * R;
    }
    // visitors drift between the surface and the bed; food brings everyone but you up and over
    if (this.drift) this.depth = 0.5 + 0.5 * Math.sin(T * 0.11 + this.seed * 3);
    let meal = null;
    if ((this.mode === 'wander' || this.mode === 'visit') && food.length) {
      let bd = 640;
      for (const q of food) {
        const d = Math.hypot(q.x - this.x, q.y - this.y);
        if (d < bd) {
          bd = d;
          meal = q;
        }
      }
      if (meal) {
        this.tx = meal.x;
        this.ty = meal.y;
        this.next = T + 2;
        this.depth *= 0.4;
        if (bd < this.size * 0.16 + 9) eat(meal, this);
      }
    }
    const dx = this.tx - this.x,
      dy = this.ty - this.y,
      d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - this.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    // The tightest arc is about half a body length, tighter when startled or closing on food; how fast it
    // can turn follows from how fast it swims, and the turn itself builds and eases instead of snapping.
    const tight = (meal ? clamp(d / (this.size * 1.2), 0.32, 1) : 1) * (1 - 0.4 * Math.min(1, this.burst));
    const wMax = Math.max(0.3, this.sp / (this.size * 0.5 * tight)),
      wGoal = clamp(da * 2.6, -wMax, wMax);
    this.w += (wGoal - this.w) * Math.min(1, dt * 5);
    this.a += this.w * dt;
    const far = clamp(d / 220, 0, 1),
      pace = this.mode === 'script' ? clamp(d / 150, 0.18, 1) : meal ? Math.max(0.6, far) * 1.5 : 0.5 + 0.5 * far;
    const goal = pace * this.cruise * (1 - 0.45 * AM.ice) * (1 + this.burst * 2.4) * (1 - 0.22 * Math.min(1, Math.abs(this.w) / wMax));
    this.sp += (goal - this.sp) * Math.min(1, dt * 2.4);
    this.burst *= Math.exp(-dt * 1.7);
    this.x += Math.cos(this.a) * this.sp * dt;
    this.y += Math.sin(this.a) * this.sp * dt;
    this.ph += dt * (2.4 + (this.sp / this.size) * 5.2);
    this.alpha = Math.min(1, this.alpha + dt * (this.shown ? 0.9 : -3));
    if (this.alpha < 0) this.alpha = 0;
    const seg = this.size * 0.1,
      s = this.spine;
    s[0].x = this.x;
    s[0].y = this.y;
    // each joint follows the one before and can bend only so far against it, the first against the head
    let back = this.a + Math.PI;
    for (let i = 1; i < N; i++) {
      let ang = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x),
        bend = ang - back;
      bend = Math.atan2(Math.sin(bend), Math.cos(bend));
      if (bend > 0.24) ang = back + 0.24;
      else if (bend < -0.24) ang = back - 0.24;
      s[i].x = s[i - 1].x + Math.cos(ang) * seg;
      s[i].y = s[i - 1].y + Math.sin(ang) * seg;
      back = ang;
    }
    if (this.sp > 70 && T > this.wake && this.alpha > 0.5) {
      drop(s[N - 1].x, s[N - 1].y, 1.2, 0.05 + this.burst * 0.25);
      this.wake = T + 0.22;
    }
  }
  draw(c) {
    if (this.alpha <= 0.01) return;
    const s = this.spine,
      S = this.size,
      HW = S * 0.13,
      P = [],
      L = [],
      R = [],
      Nx = [],
      Ny = [],
      HWs = [];
    // the tail beats harder the faster it swims, and now and then it only glides
    const live = (0.5 + clamp(this.sp / this.cruise, 0, 2.4) * 0.6) * (0.74 + 0.26 * Math.sin(T * 0.7 + this.seed));
    for (let i = 0; i < N; i++) {
      const a = s[Math.max(0, i - 1)],
        b = s[Math.min(N - 1, i + 1)];
      let tx = a.x - b.x,
        ty = a.y - b.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const nx = -ty,
        ny = tx,
        t = i / (N - 1);
      const wig = Math.sin(this.ph - t * 3.3) * S * 0.05 * t * live;
      const px = s[i].x + nx * wig,
        py = s[i].y + ny * wig;
      const f = t < 0.24 ? 0.66 + 0.34 * Math.sin((t / 0.24) * 1.5708) : 0.07 + 0.93 * Math.pow(Math.cos(((t - 0.24) / 0.76) * 1.5708), 1.15);
      P.push([px, py, tx, ty]);
      Nx.push(nx);
      Ny.push(ny);
      HWs.push(HW * f);
      L.push([px + nx * HW * f, py + ny * HW * f]);
      R.push([px - nx * HW * f, py - ny * HW * f]);
    }
    const ang = (i) => Math.atan2(P[i][3], P[i][2]);
    c.save();
    c.globalAlpha = this.alpha * (1 - 0.34 * this.depth);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // paired fins, under the body: a paddle of thin skin with rays through it
    const fin = (i, side, spread, len, wid) => {
      c.save();
      c.translate(P[i][0] + Nx[i] * side * HWs[i] * 0.82, P[i][1] + Ny[i] * side * HWs[i] * 0.82);
      c.rotate(ang(i) + Math.PI - side * spread);
      c.scale(1, side);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(len * 0.4, -wid * 0.9, len, -wid * 0.1);
      c.quadraticCurveTo(len * 1.04, wid * 0.55, len * 0.5, wid * 0.8);
      c.quadraticCurveTo(len * 0.15, wid * 0.5, 0, 0);
      c.fillStyle = this.fin;
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.24)';
      c.lineWidth = 0.7;
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const u = k / 4;
        c.moveTo(len * 0.08, 0);
        c.lineTo(len * (0.97 - 0.36 * u * u), wid * (-0.2 + 0.86 * u));
      }
      c.stroke();
      c.restore();
    };
    for (const side of [1, -1]) {
      fin(3, side, 0.9 + 0.24 * Math.sin(this.ph * 1.1 + side), S * 0.2, S * 0.075);
      fin(6, side, 0.62 + 0.12 * Math.sin(this.ph * 1.1 + 2), S * 0.1, S * 0.04);
    }
    {
      const [px, py, tx, ty] = P[N - 1],
        base = Math.atan2(-ty, -tx) + Math.sin(this.ph - 3.6) * 0.42 * live,
        ln = S * 0.3 * this.tail;
      c.beginPath();
      c.moveTo(px, py);
      for (const k of [-1, 1]) {
        const a1 = base + k * 0.52,
          a0 = base + k * 0.08;
        c.quadraticCurveTo(px + Math.cos(a1) * ln * 0.55, py + Math.sin(a1) * ln * 0.55, px + Math.cos(a1 - k * 0.1) * ln, py + Math.sin(a1 - k * 0.1) * ln);
        c.quadraticCurveTo(px + Math.cos(a0) * ln * 0.6, py + Math.sin(a0) * ln * 0.6, px, py);
      }
      c.fillStyle = this.fin;
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.lineWidth = 0.7;
      c.beginPath();
      for (const k of [-0.42, -0.26, -0.12, 0.12, 0.26, 0.42]) {
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(base + k) * ln * 0.86, py + Math.sin(base + k) * ln * 0.86);
      }
      c.stroke();
    }
    // body
    const body = new Path2D(),
      nose = [P[0][0] + P[0][2] * HW * 0.62, P[0][1] + P[0][3] * HW * 0.62];
    body.moveTo(nose[0], nose[1]);
    body.quadraticCurveTo(L[0][0] + P[0][2] * HW * 0.4, L[0][1] + P[0][3] * HW * 0.4, L[1][0], L[1][1]);
    for (let i = 2; i < N; i++) body.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
    body.lineTo(P[N - 1][0], P[N - 1][1]);
    for (let i = N - 1; i > 1; i--) body.quadraticCurveTo(R[i][0], R[i][1], (R[i - 1][0] + R[i][0]) / 2, (R[i - 1][1] + R[i][1]) / 2);
    body.quadraticCurveTo(R[1][0], R[1][1], R[0][0] + P[0][2] * HW * 0.4, R[0][1] + P[0][3] * HW * 0.4);
    body.quadraticCurveTo(R[0][0] + P[0][2] * HW * 0.4, R[0][1] + P[0][3] * HW * 0.4, nose[0], nose[1]);
    c.fillStyle = this.base;
    c.fill(body);
    c.save();
    c.clip(body);
    // markings: each a few overlapping lobes, so no two fish carry the same blot
    for (let n = 0; n < this.patches.length; n++) {
      const [i, off, r, col] = this.patches[n],
        j = this.jit[n],
        a = ang(i),
        rr = r * S,
        tx = P[i][2],
        ty = P[i][3];
      const px = P[i][0] + Nx[i] * off * HWs[i],
        py = P[i][1] + Ny[i] * off * HWs[i];
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(px, py, rr * 1.25, rr, a, 0, 6.2832);
      c.fill();
      c.beginPath();
      c.ellipse(
        px + tx * rr * (0.9 + 0.5 * j[0]) + Nx[i] * rr * 0.5 * j[1],
        py + ty * rr * (0.9 + 0.5 * j[0]) + Ny[i] * rr * 0.5 * j[1],
        rr * 0.8,
        rr * 0.62,
        a + j[2],
        0,
        6.2832
      );
      c.fill();
      c.beginPath();
      c.ellipse(
        px - tx * rr * (0.8 + 0.4 * j[3]) - Nx[i] * rr * 0.45 * j[0],
        py - ty * rr * (0.8 + 0.4 * j[3]) - Ny[i] * rr * 0.45 * j[0],
        rr * 0.7,
        rr * 0.55,
        a - j[1],
        0,
        6.2832
      );
      c.fill();
    }
    // roundness: light gathers along the back and falls off towards the flanks
    for (const [w, al] of [
      [1.5, 0.09],
      [0.9, 0.1],
      [0.42, 0.15]
    ]) {
      c.strokeStyle = `rgba(255,255,255,${al})`;
      c.lineWidth = HW * w;
      c.beginPath();
      c.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < N - 2; i++) c.lineTo(P[i][0], P[i][1]);
      c.stroke();
    }
    for (const [w, al] of [
      [0.95, 0.13],
      [0.42, 0.16]
    ]) {
      c.strokeStyle = `rgba(8,12,18,${al})`;
      c.lineWidth = HW * w;
      for (const Q of [L, R]) {
        c.beginPath();
        c.moveTo(Q[0][0], Q[0][1]);
        for (let i = 1; i < N; i++) c.lineTo(Q[i][0], Q[i][1]);
        c.stroke();
      }
    }
    c.strokeStyle = 'rgba(8,12,18,0.22)';
    c.lineWidth = Math.max(0.8, S * 0.008);
    for (const side of [1, -1]) {
      c.beginPath();
      c.arc(P[2][0] + P[2][2] * HW * 0.45, P[2][1] + P[2][3] * HW * 0.45, HWs[2] * 0.96, ang(2) + side * 1.85, ang(2) + side * 2.85, side < 0);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(8,12,18,0.24)';
    c.lineWidth = 0.8;
    c.stroke(body);
    // dorsal fin, eyes and barbels
    c.strokeStyle = this.fin;
    c.lineWidth = HW * 0.24;
    c.beginPath();
    c.moveTo(P[3][0], P[3][1]);
    for (let i = 4; i <= 7; i++) c.lineTo(P[i][0], P[i][1]);
    c.stroke();
    for (const side of [1, -1]) {
      const ex = P[1][0] + Nx[1] * side * HWs[1] * 0.74 + P[1][2] * S * 0.02,
        ey = P[1][1] + Ny[1] * side * HWs[1] * 0.74 + P[1][3] * S * 0.02,
        er = S * 0.017;
      c.fillStyle = 'rgba(10,10,12,0.8)';
      c.beginPath();
      c.arc(ex, ey, er, 0, 6.2832);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(ex - er * 0.3, ey - er * 0.35, er * 0.34, 0, 6.2832);
      c.fill();
      const bx = nose[0] + Nx[0] * side * HW * 0.3 - P[0][2] * HW * 0.12,
        by = nose[1] + Ny[0] * side * HW * 0.3 - P[0][3] * HW * 0.12;
      c.strokeStyle = this.fin;
      c.lineWidth = Math.max(0.7, S * 0.007);
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(
        bx + P[0][2] * S * 0.045 + Nx[0] * side * S * 0.02,
        by + P[0][3] * S * 0.045 + Ny[0] * side * S * 0.02,
        bx + P[0][2] * S * 0.03 + Nx[0] * side * S * 0.07,
        by + P[0][3] * S * 0.03 + Ny[0] * side * S * 0.07
      );
      c.stroke();
    }
    c.restore();
  }
}
const RED = '#dd5530',
  INK = '#1b1c20',
  WHITE = '#f3f0e8';
const ptr = { x: 0, y: 0, lx: 0, ly: 0, moved: false, at: 0 };
let kois = [],
  host,
  you;
function makeKoi() {
  host = new Koi({
    id: 'host',
    name: 'Jincheng',
    dot: '#e6b144',
    x: -160,
    y: H * 0.62,
    a: 0,
    size: big ? 168 : 120,
    cruise: 120,
    mode: 'script',
    base: '#e7ae3d',
    fin: 'rgba(238,190,96,0.6)',
    patches: [
      [2, 0, 0.05, '#f3c866'],
      [6, 0.2, 0.06, '#d99a2a']
    ]
  });
  you = new Koi({
    id: 'you',
    name: 'you',
    dot: WHITE,
    x: W * 0.5,
    y: H + 120,
    a: -1.57,
    size: big ? 104 : 80,
    cruise: 190,
    mode: 'you',
    base: WHITE,
    fin: 'rgba(244,241,234,0.55)',
    patches: [[1, 0, 0.055, RED]]
  });
  const v = [
    {
      base: WHITE,
      fin: 'rgba(244,241,234,0.5)',
      tail: 1.45,
      patches: [
        [1, 0.2, 0.07, RED],
        [4, -0.3, 0.085, RED],
        [7, 0.2, 0.06, RED],
        [9, 0, 0.04, RED]
      ]
    },
    {
      base: INK,
      fin: 'rgba(40,40,46,0.6)',
      patches: [
        [2, -0.3, 0.07, '#e8742e'],
        [5, 0.3, 0.08, WHITE],
        [8, -0.2, 0.05, '#e8742e'],
        [0, 0, 0.04, WHITE]
      ]
    },
    {
      base: '#6d93ad',
      fin: 'rgba(220,120,70,0.55)',
      patches: [
        [3, 0.9, 0.05, '#e07b42'],
        [3, -0.9, 0.05, '#e07b42'],
        [6, 0.9, 0.04, '#e07b42'],
        [6, -0.9, 0.04, '#e07b42'],
        [0, 0, 0.045, '#dfe6e6']
      ]
    }
  ].map(
    (o, i) =>
      new Koi({
        ...o,
        name: '',
        id: 'a' + i,
        x: rnd(0.15, 0.85) * W,
        y: rnd(0.2, 0.8) * H,
        a: rnd(0, 6),
        size: (big ? 118 : 86) + i * 8,
        cruise: 62 + i * 9,
        mode: 'wander',
        drift: true
      })
  );
  kois = [...v, host, you];
  for (const k of kois) nameTag(k);
  ptr.x = W * 0.5;
  ptr.y = H * 0.62;
}
function nameTag(k) {
  k.tag = document.createElement('span');
  k.tag.className = 'tag';
  k.tag.textContent = k.name;
  k.tag.hidden = !k.name;
  $('#tags').append(k.tag);
}
// Everyone else here is a koi of their own colour, named for members; they come and go with presence.
const others = new Map();
function seeVisitors(list) {
  const here = new Set(list.map((v) => v.id));
  for (const v of list) {
    if (others.has(v.id)) {
      others.get(v.id).tag.textContent = v.username || 'a visitor';
      continue;
    }
    const k = new Koi({
      id: v.id,
      name: v.username || 'a visitor',
      dot: v.color,
      base: WHITE,
      fin: 'rgba(244,241,234,0.5)',
      patches: [
        [1, 0.1, 0.06, v.color],
        [5, -0.25, 0.07, v.color],
        [8, 0.2, 0.045, v.color]
      ],
      x: rnd(0.2, 0.8) * W,
      y: H + 90,
      a: -1.57,
      size: big ? 112 : 84,
      cruise: 80,
      mode: 'wander',
      drift: true,
      person: true
    });
    nameTag(k);
    others.set(v.id, k);
    kois.unshift(k);
  }
  for (const [id, k] of others)
    if (!here.has(id)) {
      k.shown = false;
      others.delete(id);
      setTimeout(() => {
        kois = kois.filter((x) => x !== k);
        k.tag.remove();
      }, 1500);
    }
  census();
}
function drawKoi() {
  const s = fishCv.width / W;
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, fishCv.width, fishCv.height);
  fctx.setTransform(s, 0, 0, s, 0, 0);
  for (const k of kois) k.draw(fctx);
  drawShades(fctx);
}

/* ================= lily pads: they grow through spring, flower in summer, yellow and go ================= */
const padCv = document.createElement('canvas');
let padKey = '',
  padSpots = [];
// x, y, radius, turn, kind: 1 carries a lotus in summer, 2 only comes up when the pond is lush
const PADS = () =>
  big
    ? [
        [0.99, 0.4, 96, 2.5, 1],
        [0.935, 0.535, 58, 0.5, 0],
        [1.0, 0.63, 72, 4.1, 1],
        [0.012, 0.47, 86, 5.3, 1],
        [0.062, 0.6, 50, 1.2, 0],
        [0.6, -0.015, 78, 1.1, 0],
        [0.672, 0.05, 44, 3.5, 0],
        [0.9, 0.29, 46, 1.9, 2],
        [0.03, 0.33, 54, 0.8, 2],
        [0.105, 0.49, 40, 3.0, 2],
        [0.865, 0.61, 42, 5.0, 2],
        [0.75, 0.0, 50, 2.2, 2]
      ]
    : [
        [1.0, 0.36, 62, 2.5, 1],
        [0.0, 0.6, 58, 5.3, 1],
        [0.88, 0.455, 34, 0.5, 0],
        [0.1, 0.5, 36, 2, 2],
        [0.9, 0.62, 40, 4, 2]
      ];
const mixHex = (a, b, t) => {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
    x = n(a),
    y = n(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
function drawPads() {
  const c = padCv.getContext('2d'),
    s = padCv.width / W;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, padCv.width, padCv.height);
  c.setTransform(s, 0, 0, s, 0, 0);
  padSpots = [];
  for (const [x, y, r0, rot, kind] of PADS()) {
    const grow = kind === 2 ? sstep(0.55, 0.95, AM.lush) : sstep(0.02, 0.45, AM.lush),
      r = r0 * (0.55 + 0.45 * AM.lush) * Math.sqrt(grow);
    if (grow < 0.03) continue;
    c.save();
    c.globalAlpha = Math.min(1, grow * 1.6);
    c.translate(x * W, y * H);
    c.rotate(rot);
    const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, mixHex('#6aa35c', '#c2ab60', AM.brown));
    g.addColorStop(0.65, mixHex('#3f7d49', '#93803f', AM.brown));
    g.addColorStop(1, mixHex('#2a5b3a', '#5e4c28', AM.brown));
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r, 0.17, 6.2832 - 0.17);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(16,44,26,0.6)';
    c.lineWidth = 1.6;
    c.stroke();
    c.strokeStyle = 'rgba(214,240,200,0.17)';
    c.lineWidth = 1;
    for (let k = 0; k < 13; k++) {
      const a = 0.36 + (k * (6.2832 - 0.72)) / 12;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93);
      c.stroke();
    }
    c.strokeStyle = 'rgba(212,240,186,0.42)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r - 1.6, 3.3 - rot, 4.9 - rot);
    c.stroke();
    // in autumn the edge dries and curls
    if (AM.brown > 0.3) {
      c.strokeStyle = `rgba(70,48,22,${0.5 * AM.brown})`;
      c.lineWidth = 3;
      c.setLineDash([r * 0.3, r * 0.22]);
      c.beginPath();
      c.arc(0, 0, r - 2, 0.3, 6);
      c.stroke();
      c.setLineDash([]);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.3 + rot * 1.7,
        dx = Math.cos(a) * r * (0.3 + 0.16 * k),
        dy = Math.sin(a) * r * (0.3 + 0.16 * k),
        br = 2.2 + ((k * 7 + r0) % 3);
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.beginPath();
      c.arc(dx, dy, br, 0, 6.2832);
      c.fill();
      c.strokeStyle = 'rgba(10,40,22,0.4)';
      c.lineWidth = 0.8;
      c.stroke();
      c.save();
      c.translate(dx, dy);
      c.rotate(-rot);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.arc(-br * 0.35, -br * 0.4, br * 0.3, 0, 6.2832);
      c.fill();
      c.restore();
    }
    c.restore();
    // where something could stand on it: the part of the pad that is on the screen
    // (towards the open water, which also keeps clear of a flower in the middle)
    const cx = clamp(x * W, r * 0.5, W - r * 0.5),
      cy = clamp(y * H, r * 0.5, H - r * 0.5),
      ax = W / 2 - cx,
      ay = H / 2 - cy,
      al = Math.hypot(ax, ay) || 1,
      off = kind === 1 ? 0.5 : 0.2;
    const px = cx + (ax / al) * r * off,
      py = cy + (ay / al) * r * off;
    if (r > 26 && Math.hypot(px - x * W, py - y * H) < r * 0.8) padSpots.push({ x: px, y: py, r: r * 0.36 });
    if (kind === 1 && AM.bloom > 0.05) {
      const fr = 34 * (0.35 + 0.65 * AM.bloom) * (big ? 1 : 0.8),
        fx = clamp(x * W, fr, W - fr) + Math.cos(rot) * r * 0.1,
        fy = y * H - r * 0.12;
      c.save();
      c.translate(fx, fy);
      for (const [n, len, w, col] of [
        [11, 1, 0.34, '#f3bccb'],
        [9, 0.74, 0.32, '#f9d9e2'],
        [6, 0.46, 0.3, '#fff1f4']
      ])
        for (let k = 0; k < n; k++) {
          c.save();
          c.rotate((k / n) * 6.2832 + len * 2);
          c.beginPath();
          c.ellipse((len * fr) / 2, 0, (len * fr) / 2, (w * fr) / 2, 0, 0, 6.2832);
          c.fillStyle = col;
          c.fill();
          c.strokeStyle = 'rgba(176,84,112,0.3)';
          c.lineWidth = 0.8;
          c.stroke();
          c.restore();
        }
      c.beginPath();
      c.arc(0, 0, fr * 0.15, 0, 6.2832);
      c.fillStyle = '#e6b144';
      c.fill();
      c.restore();
    }
  }
}
function padsNow() {
  const key = `${Math.round(AM.lush * 30)}|${Math.round(AM.brown * 20)}|${Math.round(AM.bloom * 20)}`;
  if (key === padKey) return;
  padKey = key;
  drawPads();
  if (!glOK) return;
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texPads);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, padCv);
  gl.generateMipmap(gl.TEXTURE_2D);
}

/* ================= the year: twenty-four solar terms, and what each brings to the pond ================= */
const TERMS = [
  ['立春', 'Start of Spring', 2, 4],
  ['雨水', 'Rain Water', 2, 19],
  ['惊蛰', 'Awakening of Insects', 3, 6],
  ['春分', 'Spring Equinox', 3, 21],
  ['清明', 'Pure Brightness', 4, 5],
  ['谷雨', 'Grain Rain', 4, 20],
  ['立夏', 'Start of Summer', 5, 6],
  ['小满', 'Grain Buds', 5, 21],
  ['芒种', 'Grain in Ear', 6, 6],
  ['夏至', 'Summer Solstice', 6, 21],
  ['小暑', 'Minor Heat', 7, 7],
  ['大暑', 'Major Heat', 7, 23],
  ['立秋', 'Start of Autumn', 8, 8],
  ['处暑', 'End of Heat', 8, 23],
  ['白露', 'White Dew', 9, 8],
  ['秋分', 'Autumn Equinox', 9, 23],
  ['寒露', 'Cold Dew', 10, 8],
  ['霜降', "Frost's Descent", 10, 23],
  ['立冬', 'Start of Winter', 11, 7],
  ['小雪', 'Minor Snow', 11, 22],
  ['大雪', 'Major Snow', 12, 7],
  ['冬至', 'Winter Solstice', 12, 22],
  ['小寒', 'Minor Cold', 1, 6],
  ['大寒', 'Major Cold', 1, 20]
];
// where today falls among the terms: the term's index, and how far through it
function yearToday() {
  const doy = (m, d) => Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5),
    now = new Date(),
    t = doy(now.getMonth() + 1, now.getDate()),
    at = TERMS.map(([, , m, d]) => doy(m, d));
  for (let i = 0; i < 24; i++) {
    const span = (at[(i + 1) % 24] - at[i] + 365) % 365,
      into = (t - at[i] + 365) % 365;
    if (into < span) return i + into / span;
  }
  return 0;
}
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hump = (x, c, w) => {
  let d = Math.abs(x - c);
  d = Math.min(d, 24 - d);
  return 1 - sstep(w * 0.45, w, d);
};
let yearAuto = true,
  yearGoal = yearToday(),
  year = yearGoal;
// how much of each thing the pond holds at a point in the year
const AM = { petals: 0, lush: 0, bloom: 0, flies: 0, leaves: 0, brown: 0, ice: 0, snow: 0, tint: [1, 1, 1], light: 1 };
function amounts(y) {
  AM.petals = hump(y, 3.5, 4.2);
  AM.bloom = hump(y, 11, 3);
  AM.flies = hump(y, 10.5, 3.6);
  AM.leaves = hump(y, 16.6, 3.8);
  AM.lush = y < 19.5 ? sstep(-0.5, 7, y) * (1 - 0.6 * sstep(13.5, 17.5, y)) * (1 - sstep(17.5, 19.5, y)) : 0;
  AM.brown = y < 20 ? sstep(13.5, 18, y) : 0;
  const w = y < 3 ? y + 24 : y;
  AM.ice = sstep(18.7, 21.6, w) * (1 - sstep(24.2, 25.8, w));
  AM.snow = hump(y, 22.3, 2.6);
  const su = hump(y, 10, 5),
    au = hump(y, 16.5, 4),
    wi = hump(y, 22, 4.5);
  AM.tint = [1 + 0.02 * su + 0.1 * au - 0.1 * wi, 1 + 0.02 * su - 0.03 * au - 0.02 * wi, 1 - 0.03 * su - 0.17 * au + 0.07 * wi];
  AM.light = 1 + 0.25 * su - 0.4 * wi;
}
amounts(year);
function setYear(y) {
  yearAuto = y === undefined;
  yearGoal = yearAuto ? yearToday() : y;
  showTerm();
}
function showTerm() {
  const i = Math.floor(yearGoal) % 24;
  $('#termV').innerHTML = [...TERMS[i][0]].map((ch) => `<span>${ch}</span>`).join('');
  $('#termTxt').textContent = TERMS[i][1];
}
function stepYear(dt) {
  let d = yearGoal - year;
  if (d > 12) d -= 24;
  if (d < -12) d += 24;
  if (Math.abs(d) < 0.001) return;
  year = (year + d * Math.min(1, dt * (RM ? 99 : 1.6)) + 24) % 24;
  amounts(year);
  padsNow();
  setIce();
  pond.toggleAttribute('data-bare', AM.lush < 0.2);
}

/* ================= WebGL: the pond into a texture, then the glass over it ================= */
const VS = `#version 300 es
in vec2 a; out vec2 vUv; void main(){ vUv=vec2(a.x*.5+.5,.5-a.y*.5); gl_Position=vec4(a,0.,1.); }`;
const BED = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec2 uRes; uniform float uStone;
vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float hash1(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash1(i),hash1(i+vec2(1,0)),f.x),mix(hash1(i+vec2(0,1)),hash1(i+vec2(1,1)),f.x),f.y); }
vec3 pal(float id){ return id<.38?vec3(.52,.52,.5):id<.58?vec3(.42,.48,.52):id<.8?vec3(.58,.48,.37):id<.93?vec3(.74,.58,.34):vec3(.3,.31,.32); }
// A pile of flat pebbles: each cell holds one ellipse, the highest one covering a
// point wins, and the ones above it drop a soft shadow towards the lower right.
vec2 stoneQ(vec2 c, vec2 r, out float rad, out float asp, out vec2 cs){
  rad=mix(.44,.8,hash1(c+9.7)); asp=mix(.6,1.,hash1(c+1.9)); float ang=hash1(c+5.3)*3.1416; cs=vec2(cos(ang),sin(ang));
  return vec2(cs.x*r.x+cs.y*r.y,-cs.y*r.x+cs.x*r.y)/vec2(rad,rad*asp);
}
vec3 pebbles(vec2 x, out float cov, out float shade){
  vec2 n=floor(x),f=fract(x); float topZ=-1.; vec3 col=vec3(0.); cov=0.; shade=0.;
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 g=vec2(float(i),float(j)),c=n+g; vec2 r=f-(g+hash2(c)); float z=hash1(c+3.1),rad,asp; vec2 cs;
    vec2 q=stoneQ(c,r,rad,asp,cs); float d=length(q);
    if(d<1.&&z>topZ){ topZ=z; cov=smoothstep(1.,.965,d);
      float hgt=sqrt(1.-d*d); vec2 nl=q/vec2(rad,rad*asp); vec2 nw=vec2(cs.x*nl.x-cs.y*nl.y,cs.y*nl.x+cs.x*nl.y);
      vec3 nn=normalize(vec3(nw*rad*.5,hgt+.28));
      float diff=clamp(dot(nn,normalize(vec3(-.5,-.62,.6))),0.,1.);
      vec3 c0=pal(hash1(c+.7))*(.74+.46*hash1(c+7.3));
      c0=mix(c0,vec3(.3,.37,.24)*(.75+.5*hash1(c+2.2)),smoothstep(.5,.85,noise(x*1.4+c*.37))*.55);
      c0*=.8+.4*(noise(x*30.+c)*.4+noise(x*75.)*.35+noise(x*160.)*.25);
      float wet=pow(clamp(dot(nn,normalize(vec3(-.32,-.42,.85))),0.,1.),26.)*.2;
      float edge=mix(.4,1.,smoothstep(1.,.6,d));
      col=(c0*(.2+1.02*diff)+wet)*edge; }
  }
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 g=vec2(float(i),float(j)),c=n+g; float z=hash1(c+3.1); if(z<=topZ) continue;
    vec2 r=f-(g+hash2(c))-vec2(.07,.1); float rad,asp; vec2 cs; float d=length(stoneQ(c,r,rad,asp,cs));
    shade=max(shade,smoothstep(1.18,.9,d));
  }
  return col;
}
void main(){
  vec2 p=vec2(vUv.x,1.-vUv.y)*uRes/uStone; float a1,s1,a2,s2;
  vec3 c1=pebbles(p,a1,s1); vec3 c2=pebbles(p*2.3+vec2(3.7,1.9),a2,s2);
  vec3 under=mix(vec3(.05,.055,.05),c2*(1.-.5*s2),a2)*.5;
  vec3 col=mix(under,c1,a1)*(1.-.62*s1);
  col*=.86+.28*noise(p*.7);
  o=vec4(col,1.);
}`;

// The pond. Three layers lie at three depths (what floats, the koi, the bed) and each is
// sharp or soft by how far it is from the focus. Ice grows in from the banks over a field
// of slow noise shared with the ripple simulation, so nothing moves under it.
const FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uBed,uH,uFish,uPads,uTop,uIceN;
uniform vec2 uRes,uGrid,uMoonPos,uCss; uniform float uTime,uAmb,uCaI,uMoon,uSwell,uFocus,uIce,uSnow; uniform vec2 uCalm;
uniform vec3 uTint,uCaC,uSky,uSeason;
uniform vec4 uBox[12]; uniform vec4 uBoxB[12]; uniform int uBoxN; uniform vec4 uCrack[6]; uniform float uBroke[6]; uniform vec4 uInk; uniform vec3 uBlot[10];
float hash1(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash1(i),hash1(i+vec2(1,0)),f.x),mix(hash1(i+vec2(0,1)),hash1(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
// the panes throw a soft shadow on the bed, down and to the right of them
float thrown(vec2 P){ float s=0.;
  for(int i=0;i<12;i++){ if(i>=uBoxN) break; vec4 b=uBox[i],e=uBoxB[i]; vec2 d=P-b.xy-vec2(20.,32.); d=vec2(e.x*d.x+e.y*d.y,-e.y*d.x+e.x*d.y);
    vec2 q=abs(d)-b.zw+e.z; s=max(s,smoothstep(20.,-12.,length(max(q,0.))+min(max(q.x,q.y),0.)-e.z)*e.w); }
  return s; }
float caustic(vec2 uv,float t){
  vec2 p=mod(uv*6.2831853,6.2831853)-250.; vec2 i=p; float c=1.;
  for(int n=0;n<4;n++){ float tt=t*(1.-(3.5/float(n+1)));
    i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005))); }
  c/=4.; c=1.17-pow(c,1.4); return pow(abs(c),8.);
}
// how soft a layer at this depth is drawn: nothing within reach of the focus, more beyond it
float soft(float depth){ return max(0.,abs(depth-uFocus)-.42)*5.2; }
// the seams of the ice: the borders between cells of scattered points
float seams(vec2 x){ vec2 n=floor(x),f=fract(x); float d1=9.,d2=9.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 r=g+hash2(n+g)-f; float d=dot(r,r); if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;} }
  return smoothstep(.03,0.,sqrt(d2)-sqrt(d1)); }
// A place where the ice was struck. Cracks run out from it along spokes and round it in rings; struck again,
// it gives way along the outer ring, and the plates between the cracks float apart and tip under one by one.
// Returns how bright the cracks are, how open the water is, the plates, and the distance to the hole's rim.
vec4 struck(vec2 P, vec4 c, float broke){
  vec2 d=P-c.xy; float R=c.w, sd=hash1(c.xy); if(length(d)>R*1.35) return vec4(0.,0.,0.,99.);
  d+=(vec2(noise(P*.04+sd*9.),noise(P*.04+sd*9.+17.))-.5)*22.*smoothstep(0.,26.,length(d));
  float r=length(d), N=6.+floor(sd*3.), sec=6.2831853/N, a=atan(d.y,d.x)+sd*6.2831853+6.2831853, grow=c.z*640., fade=1.-smoothstep(60.,88.,c.z);
  a+=.2*sin(a*2.+sd*20.)+.11*sin(a*3.+sd*40.);
  float k=mod(floor(a/sec),N), da=(fract(a/sec)-.5)*sec, hk=hash1(vec2(k,sd*57.)), len=R*(.82+.3*hk), end=min(len,grow);
  float lx=r*cos(da), ly=r*sin(da)+(noise(vec2(r*.05,k*7.3+sd*31.))-.5)*13.*smoothstep(4.,30.,r);
  float line=smoothstep(1.6,0.,abs(ly))*smoothstep(end,end-12.,lx);
  vec2 bd=vec2(cos(.6),sin(.6)*(fract(hk*5.)>.5?1.:-1.)), q=vec2(lx-len*(.3+.3*hk),ly); float tt=clamp(dot(q,bd),0.,len*.32);
  line=max(line,smoothstep(1.3,0.,length(q-bd*tt))*step(.3,fract(hk*7.))*step(lx,grow)*.85);
  float a2=a+sec*.5, k2=mod(floor(a2/sec),N), th=(fract(a2/sec)-.5)*sec, cx=r*cos(th)/cos(sec*.5), h2=hash1(vec2(k2,sd*91.)), r1=R*(.25+.15*h2), r2=R*(.57+.22*fract(h2*13.));
  line=max(line,smoothstep(1.3,0.,abs(cx-r1))*step(.3,h2)*step(r1,grow)*.6);
  line=max(line,smoothstep(1.3,0.,abs(cx-r2))*step(broke<0.?.5:2.,fract(h2*5.))*step(r2,grow)*.55);
  line+=smoothstep(9.,0.,r)*.55+smoothstep(R*.45,0.,r)*.07;
  float open=0., floe=0., rim=99.;
  if(broke>=0.){
    float Rh=r2*(1.-smoothstep(35.,80.,broke)); rim=cx-Rh; open=smoothstep(1.,-1.,rim);
    float outer=step(r1,cx), hp=hash1(vec2(k2*3.+outer,sd*13.)), gap=(1.+9.*hp)*smoothstep(0.,1.+hp*2.5,broke);
    float cf=cx+sin(uTime*1.3+hp*40.)*1.3+(hp-.5)*7.*smoothstep(0.,7.,broke);   // each plate bobs, and drifts a little in or out
    float dd=min(outer>.5?min(cf-r1,Rh-cf):r1-cf, r*sin(sec*.5-abs(th)));
    float stay=step(fract(hp*9.),.3), gone=(1.-stay)*smoothstep(hp*13.+1.5,hp*13.+4.5,broke);
    floe=smoothstep(gap,gap+5.,dd)*(1.-gone)*open;
  }
  return vec4(line*fade*(1.-open),open,floe,rim);
}
void main(){
  vec2 uv=vUv, px=1./uGrid; float asp=uRes.x/uRes.y; vec2 ia=vec2(1./asp,1.); vec2 p=vec2(uv.x*asp,uv.y), P=uv*uCss;
  float h=texture(uH,uv).r, hl=texture(uH,uv-vec2(px.x,0.)).r, hr=texture(uH,uv+vec2(px.x,0.)).r, hu=texture(uH,uv-vec2(0.,px.y)).r, hd=texture(uH,uv+vec2(0.,px.y)).r;
  float fld=min(min(uv.x,1.-uv.x)*asp,min(uv.y,1.-uv.y))*2.+(texture(uIceN,uv).r-.5)*.5, cI=uIce*1.4;
  float ice=uIce<=0.?0.:1.-smoothstep(cI-.08,cI+.02,fld);
  vec4 hit=vec4(0.,0.,0.,99.);
  if(ice>0.){ vec2 Pw=P+vec2(hr-hl,hd-hu)*25.; for(int i=0;i<6;i++){ if(uCrack[i].z<0.) continue; vec4 s=struck(Pw,uCrack[i],uBroke[i]); hit=vec4(max(hit.x,s.x),max(hit.y,s.y),max(hit.z,s.z),min(hit.w,s.w)); } ice*=1.-hit.y; }
  vec2 sw=vec2(cos(p.x*7.+uTime*.6)+cos(p.x*3.1-p.y*4.3+uTime*.4),cos(p.y*6.-uTime*.5)+sin(p.x*4.2+p.y*2.7-uTime*.45))*.011*uSwell;
  vec2 g=(vec2(hr-hl,hd-hu)+sw)*(1.-ice)+ice*(vec2(noise(p*13.),noise(p*13.+7.))-.5)*.07; float lap=(hl+hr+hu+hd-4.*h)*(1.-ice);
  vec2 ref=g*ia*.06;
  float lb=soft(1.)+ice*1.7, lf=soft(.55)+ice*2., ls=soft(0.);
  // where the type stands: the left of a wide pond, all of a narrow one
  float calm=uCalm.y*(uCalm.x<.5?1.-smoothstep(.26,.64,uv.x):.82); lb+=calm*2.7; lf+=calm*2.3; ls+=calm*1.7;
  vec3 bed=vec3(textureLod(uBed,uv+ref*1.14,lb).r,textureLod(uBed,uv+ref,lb).g,textureLod(uBed,uv+ref*.86,lb).b);
  float ca=caustic(p*2.1+g*.9,uTime*.4)*(1.-ice*.85)/(1.+lb*.9);
  float focus=clamp(-lap*3.2,-.4,1.);
  vec3 col=bed*uAmb;
  vec2 so=vec2(.011,.018)*ia;
  float ps=textureLod(uPads,uv+ref*.5+so*1.7,ls+1.2).a, ts=textureLod(uTop,uv+ref*.5+so*1.3,ls+1.4).a;
  float fs=.5*(textureLod(uFish,uv+ref+so,lf+1.).a+textureLod(uFish,uv+ref+so*1.25,lf+1.).a);
  float bs=thrown((uv+ref)*uCss);
  col*=1.-.5*ps; col*=1.-.42*fs; col*=1.-.44*ts*(1.-ice); col*=1.-.5*bs;
  col+=uCaC*uCaI*(ca*1.5+focus*.55)*(.3+bed*1.1)*(1.-.75*ps)*(1.-.65*bs);
  col*=uTint*uSeason;
  vec4 f=textureLod(uFish,uv+ref*.55,lf);
  vec3 fc=f.rgb*(uAmb*.8+.2)*mix(vec3(1.),uTint*uSeason,.42)*(1.+uCaI*ca*.6+focus*.25)*(1.-.3*bs);
  col=fc+col*(1.-f.a);
  // the canopy and the sky above, mirrored in the water: it comes forward as the focus rises
  float up=pow(clamp((.52-uFocus)/.52,0.,1.),1.3)*(1.-ice);
  vec2 rp=p*1.25+g*3.2+vec2(uTime*.008,0.);
  float canopy=smoothstep(.5,.62,fbm(rp*2.3+3.)), cloud=fbm(rp*.9+vec2(uTime*.015,5.));
  col=mix(col,mix(uSky*.85,vec3(1.),cloud*.55)*(1.-canopy*.84),up*.56);
  vec3 n=normalize(vec3(-g*5.,1.)); vec3 hv=normalize(normalize(vec3(-.45,-.55,.7))+vec3(0.,0.,1.));
  float spec=pow(max(dot(n,hv),0.),90.)*(1.-ice);
  col=mix(col,uSky,clamp(length(g)*2.2,0.,1.)*.26*(1.-ice));
  col+=uSky*spec*.85;
  vec2 md=(uv-uMoonPos)*vec2(asp,1.)+g*2.4;
  col+=uMoon*(1.-ice*.7)*(vec3(.95,.97,1.)*smoothstep(.05,.018,length(md))*.6+vec3(.5,.62,.85)*exp(-dot(md,md)*60.)*.3);
  if(ice>0.){
    vec3 ic=mix(col,vec3(.8,.89,.94),.2+.16*noise(p*9.));
    ic+=vec3(.9,.97,1.)*(seams(p*1.7)*.2*smoothstep(.35,.7,noise(p*1.1+2.))+seams(p*4.6+4.)*.05);
    vec2 gb=floor(P/13.),fb=fract(P/13.)-.5; float hb=hash1(gb);
    ic+=vec3(.95,.98,1.)*step(.84,hb)*smoothstep(.2,.08,length(fb-(hash2(gb)-.5)*.5))*.3*(.4+.6*noise(p*3.+9.));
    ic+=vec3(.95,.98,1.)*hit.x+vec3(.9,.97,1.)*smoothstep(6.,0.,hit.w)*step(0.,hit.w)*.4;
    ic=mix(ic,vec3(.96,.98,1.),smoothstep(.48,.78,fbm(p*4.+7.))*uSnow*.88);
    ic+=vec3(.9,.97,1.)*smoothstep(0.,.3,ice)*(1.-smoothstep(.3,.9,ice))*.34;
    ic+=vec3(.1)*pow(max(0.,1.-length(uv-vec2(.25,.2))*1.25),3.);
    col=mix(col,ic,ice*.93);
  }
  if(hit.y>0.){   // where it has been broken through: the lip of the ice seen in the water, and the plates afloat
    col=mix(col,vec3(.6,.8,.9),smoothstep(-9.,0.,hit.w)*hit.y*.3);
    col=mix(col,uSky,.07*hit.y);
    float on=smoothstep(0.,.25,hit.z); vec3 plate=mix(col,vec3(.8,.89,.94),.5+.14*noise(p*9.))+vec3(.9,.97,1.)*(1.-smoothstep(.25,1.,hit.z))*.26;
    col=mix(col,plate,on);
  }
  vec4 pd=textureLod(uPads,uv+g*ia*.006,ls);
  col=pd.rgb*(uAmb*.78+.22)*mix(vec3(1.),uTint*uSeason,.28)+col*(1.-pd.a);
  vec4 tp=textureLod(uTop,uv+g*ia*.004,ls);
  col=tp.rgb*(uAmb*.74+.26)*mix(vec3(1.),uTint*uSeason,.22)+col*(1.-tp.a);
  vec2 q=uv-.5; col*=1.-dot(q,q)*.6;
  col=mix(col*(1.-.5*calm),vec3(.02,.09,.1),calm*.3);
  // ---------- ink and paper: what the ink front has passed over is a painting on xuan paper ----------
  if(uInk.w>0.){
    float fib=fbm(P*.03)*.55+noise(P*.21)*.25+noise(P*vec2(1.1,.06))*.12+noise(P*vec2(.05,1.3))*.08;
    float r=length(P-uInk.yz)+(fib-.5)*150.+(noise(P*.012+uInk.x*.003)-.5)*120.;
    float inside=1.-smoothstep(uInk.x-40.,uInk.x+40.,r);
    float wetEdge=exp(-pow((r-uInk.x)/38.,2.))*step(1.,uInk.x)*(1.-step(.999,uInk.w));
    // the paper: warm, uneven, with fibres
    vec3 paper=vec3(.925,.885,.8)*(.95+.07*fbm(P*.012))-vec3(.04,.045,.05)*smoothstep(.62,.95,noise(P*vec2(.9,.04)))-vec3(.025)*smoothstep(.7,1.,noise(P*vec2(.03,.7)));
    paper*=1.-.18*dot(uv-.5,uv-.5);
    vec3 INK=vec3(.075,.07,.065);
    // the fish: a pale wash for the body, dark where the body ends, the scales' patches as darker strokes, red kept as cinnabar
    vec2 fuv=uv+ref*.25;
    vec4 f0=textureLod(uFish,fuv,.0); float fa=textureLod(uFish,fuv,1.).a, fb=textureLod(uFish,fuv,3.2).a, fc2=textureLod(uFish,fuv+vec2(.004,.006),4.5).a;
    vec3 fcol=f0.rgb/max(f0.a,1e-3); float lum=dot(fcol,vec3(.3,.59,.11)), red=clamp((fcol.r-max(fcol.g,fcol.b))*2.2-.4,0.,1.)*f0.a;
    float bleed=fbm(P*.08+3.)*.5+.5;
    float wash=fb*(.32+.2*bleed)+fa*(.18+.55*(1.-lum))*(1.-red);
    float edge=clamp((fa-fb)*2.6,0.,1.)*(.6+.4*bleed);
    float shadow=fc2*.12;
    vec3 ink=paper*(1.-shadow);
    ink=mix(ink,INK,clamp(wash*.8+edge*.75,0.,.95));
    ink=mix(ink,vec3(.72,.2,.13),red*.75);
    // the water: only where it moves, a few grey rings
    ink=mix(ink,INK,smoothstep(.006,.02,-lap)*.16);
    // pads as broad pale washes with a darker rim; petals, leaves and boats as small strokes
    vec4 pd2=textureLod(uPads,uv+g*ia*.006,ls+.5); float pr=textureLod(uPads,uv,ls+3.).a;
    ink=mix(ink,vec3(.35,.38,.33),pd2.a*(.28+.25*fbm(P*.05))); ink=mix(ink,INK,clamp((pd2.a-pr)*1.8,0.,.5));
    vec4 tp2=textureLod(uTop,uv+g*ia*.004,ls); float tl=dot(tp2.rgb/max(tp2.a,1e-3),vec3(.3,.59,.11));
    ink=mix(ink,INK,tp2.a*(.35+.5*(1.-tl)));
    // blots where the paper was touched: ink spreading, fastest at first, the rim darker as it dries
    for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
      float t=b.z, R2=10.+70.*sqrt(t)*(1.-exp(-t*.9))+18.*t, d=length(P-b.xy)+(fbm((P-b.xy)*.06+b.x*.01)-.5)*R2*.55;
      float core=1.-smoothstep(R2*.25,R2,d), rim=exp(-pow((d-R2*.9)/(5.+R2*.08),2.)), halo=1.-smoothstep(R2,R2*1.6,d);
      float dens=exp(-t*.05)*(.5+.5*exp(-t*.5));
      ink=mix(ink,INK,clamp(core*dens*.7+rim*dens*.3+halo*dens*.08,0.,.9));
    }
    col=mix(col,ink,inside);
    col=mix(col,INK,wetEdge*.55);
  }
  o=vec4(col,1.);
}`;
// The second pass. Inside a pane the picture is blurred and smoked; towards the rim it is
// pulled sideways as through the edge of a lens, and the rim itself catches the light. In
// the cold, frost gathers along the rim.
const GLASS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform vec2 uCss; uniform float uLod,uFrost; uniform vec3 uGlass;
uniform vec4 uPane[12]; uniform vec4 uPaneB[12]; uniform int uPaneN;
float sd(vec2 p,vec4 b,float r){ vec2 q=abs(p-b.xy)-b.zw+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
vec3 scene(vec2 P,float lod){ return textureLod(uScene,vec2(P.x/uCss.x,1.-P.y/uCss.y),lod).rgb; }
float grain(vec2 P){ return fract(sin(dot(floor(P),vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 P=vUv*uCss; vec3 col=scene(P,0.);
  for(int i=0;i<12;i++){ if(i>=uPaneN) break; vec4 b=uPane[i]; float r=uPaneB[i].x,a=uPaneB[i].y;
    float d=sd(P,b,r); if(d>1.||a<.004) continue;
    vec2 n=vec2(sd(P+vec2(1.,0.),b,r)-sd(P-vec2(1.,0.),b,r),sd(P+vec2(0.,1.),b,r)-sd(P-vec2(0.,1.),b,r)); n/=max(length(n),1e-4);
    float e=smoothstep(-24.,0.,d); e*=e;
    vec2 Q=P-n*e*24.;
    vec3 g=(scene(Q,uLod)*2.+scene(Q+vec2(7.,5.),uLod-.7)+scene(Q+vec2(-6.,6.),uLod-.7)+scene(Q+vec2(5.,-7.),uLod-.7)+scene(Q+vec2(-7.,-5.),uLod-.7))/6.;
    g=mix(g,uGlass,.43)*1.05;
    g+=vec3(.055)*(1.-clamp((P.y-(b.y-b.w))/(2.*b.w),0.,1.));
    float rim=smoothstep(-3.2,-.4,d), lit=clamp(dot(n,normalize(vec2(-.55,-.83))),0.,1.), dark=clamp(dot(n,normalize(vec2(.55,.83))),0.,1.);
    g+=vec3(.92,1.,1.)*rim*(.07+.36*lit*lit);
    g-=vec3(.09)*rim*dark;
    g+=vec3(1.)*e*.035;
    float fr=smoothstep(-38.,-2.,d); g=mix(g,vec3(.86,.93,.97),uFrost*fr*fr*(.12+.5*grain(P*.7)*grain(P*.31+3.)));
    col=mix(col,g,smoothstep(.7,-.7,d)*a);
  }
  o=vec4(col,1.);
}`;
let gl,
  prog,
  bedProg,
  glassProg,
  U = {},
  UG = {},
  texH,
  texFish,
  texPads,
  texBed,
  texTop,
  texIce,
  texScene,
  fbo,
  sceneFbo,
  glOK = false,
  glDpr = 1;
function sh(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function mk(fs) {
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
function tex(filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [
    [gl.TEXTURE_MIN_FILTER, filter],
    [gl.TEXTURE_MAG_FILTER, filter],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]
  ])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}
// a texture that can be read soft: it keeps smaller copies of itself
function deep() {
  const t = tex(gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  return t;
}
function initGL() {
  gl = glc.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return;
  prog = mk(FS);
  bedProg = mk(BED);
  glassProg = mk(GLASS);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  for (const n of [
    'uBed',
    'uH',
    'uFish',
    'uPads',
    'uTop',
    'uIceN',
    'uRes',
    'uGrid',
    'uMoonPos',
    'uCss',
    'uTime',
    'uAmb',
    'uCaI',
    'uMoon',
    'uSwell',
    'uFocus',
    'uIce',
    'uSnow',
    'uTint',
    'uCaC',
    'uSky',
    'uSeason',
    'uBox',
    'uBoxB',
    'uBoxN',
    'uCrack',
    'uBroke',
    'uCalm',
    'uInk',
    'uBlot'
  ])
    U[n] = gl.getUniformLocation(prog, n);
  for (const n of ['uScene', 'uCss', 'uLod', 'uFrost', 'uGlass', 'uPane', 'uPaneB', 'uPaneN']) UG[n] = gl.getUniformLocation(glassProg, n);
  texH = tex(gl.LINEAR);
  texIce = tex(gl.LINEAR);
  texFish = deep();
  texPads = deep();
  texBed = deep();
  texTop = deep();
  texScene = deep();
  fbo = gl.createFramebuffer();
  sceneFbo = gl.createFramebuffer();
  glOK = true;
}
function sizeGL() {
  const dpr = (glDpr = Math.min(window.devicePixelRatio || 1, 1.5));
  glc.width = Math.round(W * dpr);
  glc.height = Math.round(H * dpr);
  const fs = big ? 0.8 : 1;
  fishCv.width = topCv.width = Math.round(W * fs);
  fishCv.height = topCv.height = Math.round(H * fs);
  padCv.width = Math.round(W * Math.min(dpr, 1.25));
  padCv.height = Math.round(H * Math.min(dpr, 1.25));
  adpr = Math.min(window.devicePixelRatio || 1, 2);
  air.width = Math.round(W * adpr);
  air.height = Math.round(H * adpr);
  padKey = '';
  padsNow();
  if (!glOK) return;
  // the pebble bed never changes, so it's drawn once into a texture
  gl.bindTexture(gl.TEXTURE_2D, texBed);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, glc.width, glc.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texBed, 0);
  gl.viewport(0, 0, glc.width, glc.height);
  gl.useProgram(bedProg);
  gl.uniform2f(gl.getUniformLocation(bedProg, 'uRes'), glc.width, glc.height);
  gl.uniform1f(gl.getUniformLocation(bedProg, 'uStone'), (big ? 132 : 96) * dpr);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, texScene);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, glc.width, glc.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texScene, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// Ice: a field of slow noise over the ripple grid says where it reaches first. The picture and
// the simulation read the same field, so the water is still exactly where the ice is drawn.
let iceN = new Float32Array(1),
  iceM = new Float32Array(1),
  iceB = new Float32Array(1),
  iceKey = -1;
function makeIce() {
  iceN = new Float32Array(GW * GH);
  iceM = new Float32Array(GW * GH);
  iceB = new Float32Array(GW * GH);
  iceKey = -1;
  const hh = (i, j) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const vn = (x, y) => {
    const i = Math.floor(x),
      j = Math.floor(y),
      fx = x - i,
      fy = y - j,
      ux = fx * fx * (3 - 2 * fx),
      uy = fy * fy * (3 - 2 * fy);
    return (hh(i, j) * (1 - ux) + hh(i + 1, j) * ux) * (1 - uy) + (hh(i, j + 1) * (1 - ux) + hh(i + 1, j + 1) * ux) * uy;
  };
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = (i / GW) * (W / H) * 2.6,
        y = (j / GH) * 2.6;
      iceN[j * GW + i] = 0.5 * vn(x, y) + 0.3 * vn(x * 2.1 + 5, y * 2.1) + 0.2 * vn(x * 4.3, y * 4.3 + 9);
    }
  if (glOK) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, texIce);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, GW, GH, 0, gl.RED, gl.FLOAT, iceN);
  }
  setIce();
}
function setIce() {
  const key = Math.round(AM.ice * 80);
  if (key === iceKey) return;
  iceKey = key;
  const c = AM.ice * 1.4,
    asp = W / H;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const u = (i + 0.5) / GW,
        v = (j + 0.5) / GH,
        f = Math.min(Math.min(u, 1 - u) * asp, Math.min(v, 1 - v)) * 2 + (iceN[j * GW + i] - 0.5) * 0.5;
      iceB[j * GW + i] = AM.ice <= 0 ? 0 : 1 - sstep(c - 0.08, c + 0.02, f);
    }
  holes(true);
}
const iceAt = (x, y) => iceM[clamp(((y / H) * GH) | 0, 0, GH - 1) * GW + clamp(((x / W) * GW) | 0, 0, GW - 1)] || 0;
// Struck, the ice cracks; struck again on its cracks (or once, where it is thin) it breaks through along
// them, and the water there is open until it freezes over again. `iceB` is the ice before any holes.
const cracks = [];
let holeAt = -9,
  holed = false;
const holeR = (q) => q.r * 0.68 * (1 - sstep(35, 80, T - q.broke));
function crack(x, y) {
  const near = cracks.find((q) => q.broke < 0 && T - q.at < 60 && Math.hypot(q.x - x, q.y - y) < q.r * 0.8);
  if (near) {
    near.broke = T;
    plip('crack', 1.3);
    return;
  }
  cracks.unshift({ x, y, at: T, r: rnd(78, 112), broke: AM.ice < 0.45 || iceAt(x, y) < 0.8 ? T + 0.22 : -1, wet: false });
  cracks.length = Math.min(cracks.length, 6);
  plip('crack');
}
function holes(now) {
  const live = cracks.filter((q) => q.broke >= 0 && T >= q.broke && holeR(q) > 2),
    fresh = live.filter((q) => !q.wet);
  if (!now && !fresh.length && (T - holeAt < 0.25 || (!live.length && !holed))) return;
  holeAt = T;
  holed = live.length > 0;
  iceM.set(iceB);
  const sx = GW / W,
    sy = GH / H;
  for (const q of live) {
    const R = holeR(q) * 0.94;
    for (let j = Math.max(0, Math.floor((q.y - R) * sy)); j <= Math.min(GH - 1, Math.ceil((q.y + R) * sy)); j++)
      for (let i = Math.max(0, Math.floor((q.x - R) * sx)); i <= Math.min(GW - 1, Math.ceil((q.x + R) * sx)); i++) {
        const d = Math.hypot((i + 0.5) / sx - q.x, (j + 0.5) / sy - q.y);
        if (d < R) iceM[j * GW + i] *= sstep(R * 0.72, R, d);
      }
  }
  for (const q of fresh) {
    q.wet = true;
    drop(q.x, q.y, 3, -1.8);
    plip('drop');
    for (const k of kois) if (Math.hypot(k.x - q.x, k.y - q.y) < 150) k.burst = Math.max(k.burst, 0.6);
  }
}

// Where the panes are, read from the page every frame: the glass follows its type through
// every fade, slide and scroll. The same boxes throw shadows on the bed.
const paneA = new Float32Array(48),
  paneB = new Float32Array(48),
  boxA = new Float32Array(48),
  boxB = new Float32Array(48);
let paneN = 0,
  boxN = 0,
  paneEls = [];
function panes() {
  const pr = pond.getBoundingClientRect();
  paneN = boxN = 0;
  for (const el of paneEls) {
    const a = parseFloat(getComputedStyle(el).opacity);
    if (!(a > 0.004) || paneN >= 11) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < pr.top - 60 || r.top > pr.bottom + 60) continue;
    const rad = Math.min(+el.dataset.r || 20, r.height / 2),
      box = [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2, r.width / 2, r.height / 2];
    paneA.set(box, paneN * 4);
    paneB.set([rad, a, 0, 0], paneN * 4);
    paneN++;
    boxA.set(box, boxN * 4);
    boxB.set([1, 0, rad, a * 0.6], boxN * 4);
    boxN++;
  }
}
const underGlass = (x, y) => {
  for (let i = 0; i < paneN; i++)
    if (paneB[i * 4 + 1] > 0.5 && Math.abs(x - paneA[i * 4]) < paneA[i * 4 + 2] && Math.abs(y - paneA[i * 4 + 1]) < paneA[i * 4 + 3]) return true;
  return false;
};

/* ================= the time of day ================= */
const PH = {
  dawn: { tint: [0.7, 0.8, 0.82], amb: 0.86, cai: 0.3, cac: [1, 0.86, 0.8], sky: [1, 0.8, 0.76], moon: 0 },
  day: { tint: [0.78, 0.94, 0.88], amb: 1.04, cai: 0.72, cac: [1, 1, 0.9], sky: [0.84, 0.95, 1], moon: 0 },
  dusk: { tint: [0.86, 0.66, 0.52], amb: 0.86, cai: 0.36, cac: [1, 0.72, 0.42], sky: [1, 0.66, 0.4], moon: 0 },
  night: { tint: [0.36, 0.5, 0.68], amb: 0.74, cai: 0.14, cac: [0.7, 0.82, 1], sky: [0.55, 0.66, 0.95], moon: 1 }
};
let phaseChoice = 'auto',
  phase = 'day',
  cur = null,
  raining = false;
const autoPhase = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
};
function setPhase(choice) {
  phaseChoice = choice;
  phase = choice === 'auto' ? autoPhase() : choice;
  pond.dataset.phase = phase;
  if (!cur) cur = JSON.parse(JSON.stringify(PH[phase]));
}
function easePhase(dt) {
  const t = PH[phase],
    k = Math.min(1, dt * 1.6);
  for (const key of ['amb', 'cai', 'moon']) cur[key] += (t[key] - cur[key]) * k;
  for (const key of ['tint', 'cac', 'sky']) for (let i = 0; i < 3; i++) cur[key][i] += (t[key][i] - cur[key][i]) * k;
}

/* ================= on the water: boats, food, petals in spring, leaves in autumn ================= */
// Painted on a layer of their own that lies at the surface, so the focus treats them apart from the koi.
const topCv = document.createElement('canvas'),
  tctx = topCv.getContext('2d'),
  TAU = Math.PI * 2;
const boats = [],
  food = [],
  petals = [],
  leaves = [],
  shades = [];
const HULL = [
    [new Path2D('M2 30 30 9h60l28 21-28 21H30z'), '#d9d7cc'],
    [new Path2D('M2 30 30 9h60l28 21z'), '#f2f1ea'],
    [new Path2D('M38 30 60 5l22 25-22 25z'), '#fbfaf5'],
    [new Path2D('M38 30 60 55l22-25z'), '#e6e4da']
  ],
  FOLD = new Path2D('M60 5v50M2 30h116');
const LEAF = [
  new Path2D('M0 -10L3 -4L9 -6L6 0L10 5L3 4L0 10L-3 4L-10 5L-6 0L-9 -6L-3 -4Z'),
  new Path2D('M0 9Q-11 2 -9 -7Q-4 -10 0 -6Q4 -10 9 -7Q11 2 0 9Z'),
  new Path2D('M-10 0Q0 -6.5 10 0Q0 6.5 -10 0Z')
];
const boatHome = (b) => {
  const a = T * b.drift + b.seed;
  return [W * (b.c[0] + Math.cos(a) * b.c[2]), H * (b.c[1] + Math.sin(a * 1.3) * b.c[3])];
};
function launchBoat(text, by, from) {
  const b = {
    text,
    by,
    seed: rnd(0, 9),
    drift: rnd(0.02, 0.045) * (Math.random() < 0.5 ? -1 : 1),
    c: [rnd(0.1, 0.9), rnd(0.16, 0.84), rnd(0.04, 0.09), rnd(0.04, 0.09)],
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
    r: rnd(-40, 40),
    a: 0,
    x: 0,
    y: 0
  };
  const [hx, hy] = boatHome(b);
  if (from) {
    b.ox = from[0] - hx;
    b.oy = from[1] - hy;
    drop(from[0], from[1], 3, 1.2);
  } else b.ox = (hx < W / 2 ? -1 : 1) * 240;
  boats.push(b);
  return b;
}
function feed(x, y) {
  for (let i = 0; i < 4 && food.length < 28; i++)
    food.push({ x: clamp(x + rnd(-24, 24), 10, W - 10), y: clamp(y + rnd(-24, 24), 10, H - 10), vx: rnd(-22, 22), vy: rnd(-22, 22), born: T });
}
function eat(q, k) {
  const i = food.indexOf(q);
  if (i < 0) return;
  food.splice(i, 1);
  drop(q.x, q.y, 1.7, 0.55);
  k.burst = Math.max(k.burst, 0.35);
  plip('eat', 0.7);
}
function makePetals() {
  petals.length = leaves.length = 0;
  const tones = ['#f4bccb', '#f9d7e0', '#fff0f3', '#f1a9bd'],
    fall = ['#c8452a', '#e07b2a', '#e6b144', '#a8551f', '#e9c84a', '#b9341f'];
  const n = big ? 14 : 7,
    mk = (i, tone, kind) => ({
      x: rnd(0.04, 0.96) * W,
      y: rnd(0.06, 0.94) * H,
      vx: 0,
      vy: 0,
      r: rnd(0, 6.28),
      vr: rnd(-0.2, 0.2),
      s: rnd(0.8, 1.3),
      tone,
      kind,
      age: 9,
      a: 0,
      i: i / n
    });
  for (let i = 0; i < n; i++) {
    petals.push(mk(i, tones[i % 4], 0));
    leaves.push(mk(i, fall[i % 6], i % 3));
  }
}
function drift(list, amount, dt) {
  for (const q of list) {
    const frozen = iceAt(q.x, q.y),
      [gx, gy] = slopeAt(clamp(q.x, 2, W - 2), clamp(q.y, 2, H - 2)),
      wind = RM ? 0 : 1 - frozen;
    q.a += ((q.i < amount ? 1 : 0) - q.a) * Math.min(1, dt * 1.5);
    q.vx += (-gx * 1100 + 13 * wind - q.vx * 1.2) * dt;
    q.vy += (-gy * 1100 + 6 * wind - q.vy * 1.2) * dt;
    q.x += q.vx * dt * (1 - frozen);
    q.y += q.vy * dt * (1 - frozen);
    q.r += (q.vr * wind + gx * 9) * dt;
    q.age += dt;
    // carried off the edge: another one comes down somewhere on the water
    if (q.x > W + 20 || q.y > H + 20 || q.x < -20 || q.y < -20) {
      q.x = rnd(0.05, 0.85) * W;
      q.y = rnd(0.06, 0.85) * H;
      q.vx = q.vy = 0;
      q.age = 0;
      if (q.a > 0.3) drop(q.x, q.y, 1.2, 0.32);
    }
  }
}
function stepAfloat(dt) {
  for (const b of boats) {
    const [hx, hy] = boatHome(b),
      [gx, gy] = slopeAt(clamp(hx + b.ox, 2, W - 2), clamp(hy + b.oy, 2, H - 2));
    b.vx += (-gx * 1500 - b.ox * 2.2 - b.vx * 1.8) * dt;
    b.vy += (-gy * 1500 - b.oy * 2.2 - b.vy * 1.8) * dt;
    b.ox += b.vx * dt;
    b.oy += b.vy * dt;
    b.r += (gx * 90 + (RM ? 0 : Math.sin(T * 0.4 + b.seed) * 2)) * dt;
    b.a = Math.min(1, b.a + dt * 0.8);
    b.x = hx + b.ox;
    b.y = hy + b.oy;
  }
  for (let i = food.length - 1; i >= 0; i--) {
    const q = food[i],
      [gx, gy] = slopeAt(q.x, q.y);
    q.vx += (-gx * 900 - q.vx * 1.6) * dt;
    q.vy += (-gy * 900 - q.vy * 1.6) * dt;
    q.x = clamp(q.x + q.vx * dt, 8, W - 8);
    q.y = clamp(q.y + q.vy * dt, 8, H - 8);
    if (T - q.born > 45) food.splice(i, 1);
  }
  drift(petals, AM.petals, dt);
  drift(leaves, AM.leaves, dt);
}
function drawTop() {
  const c = tctx,
    s = topCv.width / W;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, topCv.width, topCv.height);
  c.setTransform(s, 0, 0, s, 0, 0);
  for (const b of boats) {
    c.save();
    c.globalAlpha = b.a;
    c.translate(b.x, b.y);
    c.rotate((b.r * Math.PI) / 180);
    c.scale(0.5, 0.5);
    c.translate(-60, -30);
    for (const [path, fill] of HULL) {
      c.fillStyle = fill;
      c.fill(path);
    }
    c.strokeStyle = 'rgba(23,35,31,0.18)';
    c.lineWidth = 1.2;
    c.stroke(FOLD);
    c.restore();
  }
  for (const q of petals) {
    if (q.a < 0.02) continue;
    const land = clamp(q.age / 1.4, 0, 1),
      sc = q.s * (1 + (1 - land) * (1 - land) * 1.6);
    c.save();
    c.globalAlpha = land * q.a;
    c.translate(q.x, q.y);
    c.rotate(q.r);
    c.scale(sc, sc);
    c.fillStyle = q.tone;
    c.beginPath();
    c.moveTo(-7.5, 0);
    c.quadraticCurveTo(-1, -6.5, 7.5, -0.5);
    c.quadraticCurveTo(0, 5.5, -7.5, 0);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    c.ellipse(-2, -1, 3.2, 1.6, 0.2, 0, TAU);
    c.fill();
    c.restore();
  }
  for (const q of leaves) {
    if (q.a < 0.02) continue;
    const land = clamp(q.age / 1.4, 0, 1),
      sc = q.s * 1.25 * (1 + (1 - land) * (1 - land) * 1.6);
    c.save();
    c.globalAlpha = land * q.a;
    c.translate(q.x, q.y);
    c.rotate(q.r);
    c.scale(sc, sc);
    c.fillStyle = q.tone;
    c.fill(LEAF[q.kind]);
    c.strokeStyle = 'rgba(60,24,8,0.4)';
    c.lineWidth = 0.7;
    c.beginPath();
    if (q.kind === 2) {
      c.moveTo(-10, 0);
      c.lineTo(13, 0);
    } else {
      c.moveTo(0, q.kind ? -5 : -8);
      c.lineTo(0, 14);
      if (!q.kind) {
        c.moveTo(0, 2);
        c.lineTo(7, -4);
        c.moveTo(0, 2);
        c.lineTo(-7, -4);
      }
    }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.beginPath();
    c.ellipse(-2, -3, 4, 2, 0.4, 0, TAU);
    c.fill();
    c.restore();
  }
  for (const q of food) {
    c.fillStyle = '#9a6c3c';
    c.beginPath();
    c.arc(q.x, q.y, 3.1, 0, TAU);
    c.fill();
    c.fillStyle = '#d7ad74';
    c.beginPath();
    c.arc(q.x - 0.9, q.y - 1, 1.3, 0, TAU);
    c.fill();
  }
  drawBugs(c);
  drawSpider(c);
}
// what flies over the pond throws its shadow down through the water: soft, and further off the higher it is
function drawShades(c) {
  for (const q of shades) {
    const g = c.createRadialGradient(q.x, q.y, q.r * 0.2, q.x, q.y, q.r);
    g.addColorStop(0, `rgba(4,18,20,${q.a})`);
    g.addColorStop(1, 'rgba(4,18,20,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(q.x, q.y, q.r, 0, TAU);
    c.fill();
  }
  shades.length = 0;
}
function boatAt(x, y) {
  let best = null,
    bd = 34;
  for (const b of boats) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bd && !underGlass(b.x, b.y)) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function showBoat(b) {
  const tip = $('#boatTip');
  if (!b) {
    delete tip.dataset.on;
    return;
  }
  tip.innerHTML = `${esc(b.text)}<em>${esc(b.by)}</em>`;
  tip.dataset.on = '';
  tip.style.transform = `translate3d(${clamp(b.x - tip.offsetWidth / 2, 8, W - tip.offsetWidth - 8)}px,${Math.max(8, b.y - tip.offsetHeight - 26)}px,0)`;
}

/* ================= Devot's dove and ocra's spider, as models ================= */
// three.js and the models (life.js) arrive once the pond has settled; until then, and where they can't run,
// the pond does without them.
let life = null,
  lifeDt = 0.016;

/* ================= ocra's spider: a jumping spider that keeps to the lily pads ================= */
// It reads before it moves. Its eyes follow a pointer nearby and anything that lands; then it
// turns, gathers itself, and jumps. Its legs are placed one at a time, each foot staying
// where it stands until the body has moved on.
const spider = {
  x: 0,
  y: 0,
  a: 0,
  pad: -1,
  state: 'sit',
  t: 0,
  jump: 0,
  fx: 0,
  fy: 0,
  tx: 0,
  ty: 0,
  alpha: 0,
  next: 5,
  prey: null,
  grab: null,
  crouch: 0,
  feet: []
};
const bugs = [],
  LEGS = [
    [0.67, 0.64],
    [1.16, 0.58],
    [1.9, 0.565],
    [2.55, 0.655]
  ];
const spiderSize = () => (big ? 42 : 34);
const footHomes = (S) =>
  [1, -1].flatMap((side) =>
    LEGS.map(([ang, reach]) => [spider.x + Math.cos(spider.a + side * ang) * reach * S, spider.y + Math.sin(spider.a + side * ang) * reach * S])
  );
const plant = () => {
  spider.feet = footHomes(spiderSize()).map(([x, y]) => ({ x, y, sx: x, sy: y, t: 1 }));
};
function leap(x, y, pad) {
  spider.fx = spider.x;
  spider.fy = spider.y;
  spider.tx = x;
  spider.ty = y;
  spider.pad = pad;
  spider.state = 'crouch';
  spider.t = 0;
}
function otherPad() {
  let i = spider.pad;
  while (i === spider.pad) i = (Math.random() * padSpots.length) | 0;
  const q = padSpots[i],
    ang = rnd(0, TAU),
    rr = rnd(0, q.r * 0.4);
  leap(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr, i);
}
function dropBug() {
  if (!padSpots.length || bugs.length > 5) return;
  const q = padSpots[(Math.random() * padSpots.length) | 0],
    ang = rnd(0, TAU),
    rr = q.r * rnd(0.3, 0.9);
  bugs.push({
    x: Math.random() < 0.5 ? -20 : W + 20,
    y: rnd(0, H),
    tx: clamp(q.x + Math.cos(ang) * rr, 14, W - 14),
    ty: clamp(q.y + Math.sin(ang) * rr, 14, H - 14),
    state: 'fly',
    t: 0,
    rip: 0,
    r: rnd(0, 6)
  });
}
function stepSpider(dt) {
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i];
    b.t += dt;
    if (b.state === 'fly') {
      const dx = b.tx - b.x,
        dy = b.ty - b.y,
        d = Math.hypot(dx, dy) || 1;
      b.x += (dx / d) * 330 * dt + Math.sin(T * 23 + b.r) * 1.6;
      b.y += (dy / d) * 330 * dt + Math.cos(T * 19 + b.r) * 1.6;
      if (d < 8) {
        b.state = 'land';
        b.t = 0;
      }
    } else {
      if (T > b.rip) {
        drop(b.x, b.y, 1, 0.14);
        b.rip = T + 0.7;
      }
      if (b.t > 24) bugs.splice(i, 1);
    }
  }
  const S = spiderSize(),
    here = life !== null && padSpots.length > 0 && AM.ice < 0.5;
  spider.alpha += ((here ? 1 : 0) - spider.alpha) * Math.min(1, dt * 2);
  if (!here) {
    spider.pad = -1;
    return;
  }
  if (spider.pad < 0 || !padSpots[spider.pad]) {
    let best = 0;
    padSpots.forEach((q, i) => {
      if (q.r > padSpots[best].r) best = i;
    });
    spider.pad = best;
    spider.x = padSpots[best].x;
    spider.y = padSpots[best].y;
    spider.state = 'sit';
    spider.t = 0;
    plant();
  }
  const pad = padSpots[spider.pad];
  if (spider.prey && !bugs.includes(spider.prey)) spider.prey = null;
  if (!spider.prey) {
    let bd = 1e9;
    for (const b of bugs)
      if (b.state === 'land') {
        const d = Math.hypot(b.x - spider.x, b.y - spider.y);
        if (d < bd) {
          bd = d;
          spider.prey = b;
        }
      }
  }
  const look = spider.prey || (ptr.moved && Math.hypot(ptr.x - spider.x, ptr.y - spider.y) < 340 ? ptr : null);
  const face = (x, y, rate) => {
    let da = Math.atan2(y - spider.y, x - spider.x) - spider.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    spider.a += clamp(da, -dt * rate, dt * rate);
    return Math.abs(da);
  };
  spider.t += dt;
  if (spider.state === 'sit') {
    spider.crouch += (0 - spider.crouch) * Math.min(1, dt * 6);
    if (look) face(look.x, look.y, 5);
    if (spider.prey && spider.t > 1) {
      // onto whichever pad is nearest the prey, landing just short of it
      let np = spider.pad,
        nd = 1e9;
      padSpots.forEach((q, i) => {
        const d = Math.hypot(q.x - spider.prey.x, q.y - spider.prey.y);
        if (d < nd) {
          nd = d;
          np = i;
        }
      });
      const ang = Math.atan2(spider.prey.y - spider.y, spider.prey.x - spider.x);
      spider.grab = spider.prey;
      leap(spider.prey.x - Math.cos(ang) * S * 0.45, spider.prey.y - Math.sin(ang) * S * 0.45, np);
    } else if (ptr.moved && T - ptr.at < 0.5 && Math.hypot(ptr.x - spider.x, ptr.y - spider.y) < 44 && padSpots.length > 1) otherPad();
    else if (T > spider.next) {
      spider.next = T + rnd(6, 13);
      if (padSpots.length > 1 && Math.random() < 0.55) otherPad();
      else {
        const ang = rnd(0, TAU),
          rr = rnd(0, pad.r * 0.45);
        spider.wx = pad.x + Math.cos(ang) * rr;
        spider.wy = pad.y + Math.sin(ang) * rr;
        spider.state = 'walk';
      }
    }
  } else if (spider.state === 'walk') {
    const d = Math.hypot(spider.wx - spider.x, spider.wy - spider.y);
    if (d < 3 || spider.prey) {
      spider.state = 'sit';
      spider.t = 0;
    } else if (face(spider.wx, spider.wy, 6) < 0.6) {
      spider.x += Math.cos(spider.a) * 44 * dt;
      spider.y += Math.sin(spider.a) * 44 * dt;
    }
  } else if (spider.state === 'crouch') {
    face(spider.tx, spider.ty, 9);
    spider.crouch = Math.min(1, spider.t / 0.34);
    if (spider.t > 0.44) {
      spider.state = 'jump';
      spider.t = 0;
      spider.jump = 0;
    }
  } else {
    const dur = clamp(Math.hypot(spider.tx - spider.fx, spider.ty - spider.fy) / 900, 0.16, 0.5);
    spider.jump = Math.min(1, spider.t / dur);
    spider.crouch = 0;
    spider.x = spider.fx + (spider.tx - spider.fx) * spider.jump;
    spider.y = spider.fy + (spider.ty - spider.fy) * spider.jump;
    if (spider.jump >= 1) {
      spider.state = 'sit';
      spider.t = 0;
      spider.jump = 0;
      drop(spider.x, spider.y, 2, 0.5);
      plant();
      if (spider.grab) {
        const i = bugs.indexOf(spider.grab);
        if (i >= 0) {
          bugs.splice(i, 1);
          plip('eat', 0.6);
        }
        spider.grab = spider.prey = null;
        spider.next = T + rnd(5, 9);
      }
    }
  }
  const homes = footHomes(S * (spider.state === 'jump' ? 0.55 : 1 - 0.28 * spider.crouch));
  spider.feet.forEach((f, i) => {
    const [hx, hy] = homes[i];
    if (spider.state === 'jump') {
      f.x = hx;
      f.y = hy;
      f.t = 1;
      return;
    }
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / 0.09);
      f.x = f.sx + (hx - f.sx) * f.t;
      f.y = f.sy + (hy - f.sy) * f.t;
    } else if (Math.hypot(f.x - hx, f.y - hy) > S * (0.09 + 0.12 * (1 - spider.crouch)) && !spider.feet.some((g, j) => g.t < 1 && (i + j) % 2 === 1)) {
      f.sx = f.x;
      f.sy = f.y;
      f.t = 0;
    }
  });
}
function drawBugs(c) {
  for (const b of bugs) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.r);
    c.fillStyle = 'rgba(235,245,250,0.55)';
    const beat = b.state === 'fly' ? 0.6 + 0.4 * Math.sin(T * 60) : 1;
    c.beginPath();
    c.ellipse(-0.5, -3.2 * beat, 2, 3.4, 0.5, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(-0.5, 3.2 * beat, 2, 3.4, -0.5, 0, TAU);
    c.fill();
    c.fillStyle = '#14181a';
    c.beginPath();
    c.ellipse(0, 0, 3, 1.7, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}
// The model stands on the feet the pond gives it, which step as it turns and walks; sitting, it tilts
// its face up at whoever is looking down. It is drawn larger at the top of a jump.
// ---------- the ink world: a drop from the switch spreads over the pond and turns it to paper; time slows ----------
let inkTimer = 0,
  inkOn = false,
  inkR = 0,
  inkMax = 0,
  inkO = [0, 0],
  timeScale = 1,
  simAcc = 0,
  inkAt = -9,
  blots = [];
const blotU = new Float32Array(30),
  lerpN = (a, b, t) => a + (b - a) * t;
function setInk(on, from) {
  if (on === inkOn) return;
  inkOn = on;
  inkAt = performance.now() / 1000;
  const r = (from || $('#inkBtn')).getBoundingClientRect(),
    pr = pond.getBoundingClientRect();
  inkO = [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2];
  inkMax = Math.hypot(Math.max(inkO[0], W - inkO[0]), Math.max(inkO[1], H - inkO[1])) + 220;
  pond.dataset.inking = '';
  $('#inkBtn').setAttribute('aria-pressed', String(on));
  clearTimeout(inkTimer);
  inkTimer = setTimeout(
    () => {
      pond.toggleAttribute('data-ink', on);
      delete pond.dataset.inking;
    },
    on ? 700 : 900
  );
  if (on) {
    drop(inkO[0], inkO[1], 7, -3.2);
    audio();
    plip('ink');
  } else blots = [];
}
// The front runs out fast and then slows, as ink does in wet paper; time all but stops as the drop lands
// and comes back slow; going back, the paper draws in to the switch and time runs up again.
function stepInk(raw) {
  const k = performance.now() / 1000 - inkAt;
  if (inkOn) {
    inkR = inkMax * (1 - Math.exp(-k * 1.25)) * Math.min(1, 0.2 + k * 3);
    if (k > 4.5) inkR = inkMax;
  } else if (inkR > 0) {
    inkR = Math.max(0, inkR - raw * inkMax * (0.4 + k * 1.3));
  }
  const goal = inkOn ? (k < 0.5 ? 0.06 : 0.32) : inkR > 0 ? 0.25 : 1;
  timeScale += (goal - timeScale) * Math.min(1, raw * (inkOn && k < 0.5 ? 9 : 1.6));
}
let calmNow = 1,
  spiderPic = null,
  spiderSig = '',
  spiderHot = 0;
function drawSpider(c) {
  if (!life || spider.alpha < 0.02 || spider.pad < 0 || !spider.feet.length) return;
  const u = spiderSize() * 0.46,
    up = spider.state === 'jump' ? Math.sin(spider.jump * Math.PI) : 0,
    half = life.SPIDER * u * (1 + up * 0.3),
    n = life.size / 2;
  const sig = `${spider.state} ${spider.a.toFixed(2)} ${spider.crouch.toFixed(2)} ${up.toFixed(2)} ${spider.feet.map((f) => Math.round(f.x - spider.x) + ',' + Math.round(f.y - spider.y)).join(' ')}`;
  if (!spiderPic) {
    spiderPic = document.createElement('canvas');
    spiderPic.width = spiderPic.height = n;
    spiderSig = '';
  }
  if (sig !== spiderSig) {
    spiderSig = sig;
    spiderHot = T + 0.8;
  }
  if (T < spiderHot) {
    life.spider(lifeDt, {
      a: spider.a,
      feet: spider.feet.map((f) => [(f.x - spider.x) / u, (f.y - spider.y) / u]),
      crouch: spider.crouch,
      lift: up * 1.3,
      pitch: spider.state === 'sit' ? 0.4 : spider.state === 'walk' ? 0.14 : 0
    });
    const x = spiderPic.getContext('2d');
    x.clearRect(0, 0, n, n);
    x.drawImage(life.canvas, 0, n, n, n, 0, 0, n, n);
  }
  c.globalAlpha = spider.alpha;
  c.drawImage(spiderPic, spider.x - half, spider.y - half, half * 2, half * 2);
  c.globalAlpha = 1;
}

/* ================= over the water: Devot's dove, dragonflies in summer, snow in winter ================= */
// Drawn above the glass, since they are above it; their shadows are laid into the pond below.
const air = $('#air'),
  actx = air.getContext('2d');
let adpr = 1;
const dove = { state: 'away', x: 0, y: 0, a: 0, h: 1, spread: 1, ph: 0, dip: 0, t: 0, sips: 0, sipAt: 0, tx: 0, ty: 0, face: 0, next: 22 };
const flies = [0, 1].map((i) => ({ x: -50, y: -50, a: 0, tx: 0, ty: 0, next: 0, tone: i ? '#d6503a' : '#3aa7c9', a2: 0 })),
  flakes = Array.from({ length: 60 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: Math.random(), i: i / 60, s: rnd(0.7, 1.4) }));
const doveSize = () => (big ? 64 : 48);
function callDove() {
  if (!life || dove.state !== 'away') return;
  const spots = padSpots.filter((_, i) => i !== spider.pad),
    q = spots.length ? spots[(Math.random() * spots.length) | 0] : padSpots[0];
  if (!q) return;
  // it comes down on the side of the pad that faces open water
  dove.face = Math.atan2(H / 2 - q.y, W / 2 - q.x);
  dove.tx = clamp(q.x + Math.cos(dove.face) * q.r * 0.7, 30, W - 30);
  dove.ty = clamp(q.y + Math.sin(dove.face) * q.r * 0.7, 30, H - 30);
  dove.x = Math.random() < 0.5 ? -130 : W + 130;
  dove.y = rnd(-90, H * 0.5);
  dove.a = Math.atan2(dove.ty - dove.y, dove.tx - dove.x);
  dove.state = 'in';
  dove.h = 1;
  dove.t = 0;
}
function stepAir(dt) {
  if (dove.state === 'away') {
    if (T > dove.next && !letterOpen() && !sheetOpen() && padSpots.length) {
      callDove();
      dove.next = T + rnd(70, 120);
    }
  } else {
    dove.t += dt;
    if (dove.state === 'in' || dove.state === 'out') {
      const dx = dove.tx - dove.x,
        dy = dove.ty - dove.y,
        d = Math.hypot(dx, dy) || 1,
        sp = dove.state === 'in' ? clamp(d * 2.2, 80, 520) : 560;
      let da = Math.atan2(dy, dx) - dove.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      dove.a += clamp(da, -dt * 4, dt * 4);
      dove.x += Math.cos(dove.a) * sp * dt;
      dove.y += Math.sin(dove.a) * sp * dt;
      dove.ph += dt * 17;
      dove.spread = 0.62 + 0.38 * Math.sin(dove.ph);
      dove.dip = 0;
      dove.h = dove.state === 'in' ? clamp(d / 240, 0, 1) : Math.min(1, dove.h + dt * 2.4);
      if (dove.state === 'in' && d < 9) {
        dove.state = 'sit';
        dove.t = 0;
        dove.sips = 0;
        drop(dove.x, dove.y, 3, 0.9);
        plip('flap', 0.5);
      }
      if (dove.state === 'out' && d < 70) dove.state = 'away';
    } else {
      // folded up on the pad: it turns to the water, drinks four times, looks about, and goes
      dove.spread += (0 - dove.spread) * Math.min(1, dt * 8);
      dove.h = 0;
      let da = dove.face + (dove.sips >= 4 ? Math.sin(dove.t * 0.9) * 0.7 : 0) - dove.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      dove.a += clamp(da, -dt * 3, dt * 3);
      dove.dip = dove.t > 1 && dove.sips < 4 ? Math.max(0, Math.sin((((dove.t - 1) % 1.5) / 1.5) * TAU)) : 0;
      const S = doveSize();
      if (dove.dip > 0.95 && T > dove.sipAt) {
        dove.sipAt = T + 1;
        dove.sips++;
        drop(dove.x + Math.cos(dove.a) * S * 0.6, dove.y + Math.sin(dove.a) * S * 0.6, 1.4, -0.4);
        plip('drop', 0.3);
      }
      if ((dove.sips >= 4 && dove.t > 11) || (ptr.moved && T - ptr.at < 0.3 && Math.hypot(ptr.x - dove.x, ptr.y - dove.y) < 46)) {
        dove.state = 'out';
        dove.tx = dove.x < W / 2 ? -170 : W + 170;
        dove.ty = rnd(-110, H * 0.4);
        drop(dove.x, dove.y, 3, -0.7);
        plip('flap', 0.6);
      }
    }
    const S = doveSize();
    shades.push({
      x: dove.x + 12 + dove.h * 46,
      y: dove.y + 20 + dove.h * 74,
      r: S * (0.5 + 0.3 * dove.spread) * (1 + dove.h * 0.5),
      a: 0.42 * Math.min(1, dove.h * 3) * (1 - dove.h * 0.5)
    });
  }
  // dragonflies hang, then dart
  flies.forEach((f, i) => {
    const want = AM.flies * 2 > i + 0.4 ? 1 : 0;
    f.a2 += (want - f.a2) * Math.min(1, dt * 2);
    if (f.a2 < 0.02) {
      f.x = rnd(0, W);
      f.y = -40;
      return;
    }
    if (T > f.next) {
      const q = padSpots.length && Math.random() < 0.6 ? padSpots[(Math.random() * padSpots.length) | 0] : { x: rnd(0.1, 0.9) * W, y: rnd(0.1, 0.9) * H };
      f.tx = q.x + rnd(-50, 50);
      f.ty = q.y + rnd(-50, 50);
      f.next = T + rnd(0.8, 3.2);
    }
    const dx = f.tx - f.x,
      dy = f.ty - f.y,
      d = Math.hypot(dx, dy);
    if (d > 6) {
      f.a = Math.atan2(dy, dx);
      const sp = Math.min(640, d * 6);
      f.x += (dx / d) * sp * dt;
      f.y += (dy / d) * sp * dt;
    }
    shades.push({ x: f.x + 26, y: f.y + 40, r: 12, a: 0.22 * f.a2 });
  });
  for (const q of flakes) {
    q.z -= dt * 0.35 * q.s;
    q.x += dt * 0.012;
    q.y += dt * 0.02;
    if (q.z <= 0) {
      q.z = 1;
      q.x = Math.random();
      q.y = Math.random();
    }
  }
}
// The dove is laid into the air over the pond, larger the higher it flies; its light follows the time of day.
function drawDove(c) {
  if (!life || dove.state === 'away') return;
  const u = doveSize() * 0.34 * (1 + dove.h * 0.28),
    half = life.DOVE * u;
  life.dove(lifeDt, { a: dove.a, fly: dove.state !== 'sit', dip: dove.dip, h: dove.h, amb: cur ? cur.amb : 1, tint: cur ? cur.tint : [1, 1, 1] });
  c.drawImage(life.canvas, dove.x - half, dove.y - half, half * 2, half * 2);
}
function drawAir() {
  const c = actx;
  c.setTransform(adpr, 0, 0, adpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (AM.snow > 0.02 || (raining && AM.ice > 0.3)) {
    const n = Math.max(AM.snow, raining && AM.ice > 0.3 ? 0.7 : 0);
    c.fillStyle = '#fff';
    for (const q of flakes)
      if (q.i < n) {
        c.globalAlpha = Math.min(1, q.z * 2.4) * 0.85;
        c.beginPath();
        c.arc(q.x * (W + 80) - 40, q.y * (H + 80) - 40, (0.7 + q.z * 2.6) * q.s, 0, TAU);
        c.fill();
      }
    c.globalAlpha = 1;
  }
  for (const f of flies) {
    if (f.a2 < 0.02) continue;
    c.save();
    c.globalAlpha = f.a2;
    c.translate(f.x, f.y);
    c.rotate(f.a);
    c.lineCap = 'round';
    c.fillStyle = 'rgba(225,245,250,0.42)';
    const beat = 0.8 + 0.2 * Math.sin(T * 70);
    for (const [wx, ang] of [
      [4, 1.25],
      [-2, 1.75]
    ])
      for (const side of [1, -1]) {
        c.save();
        c.translate(wx, 0);
        c.rotate(side * ang);
        c.beginPath();
        c.ellipse(12 * beat, 0, 13, 3.4, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    c.strokeStyle = f.tone;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(-20, 0);
    c.stroke();
    c.fillStyle = '#1c2a2e';
    c.beginPath();
    c.arc(9, 0, 3.3, 0, TAU);
    c.fill();
    c.restore();
  }
  drawDove(c);
}

// The shade of a tree over the pond: boughs of leaves drawn once, blurred and swayed by CSS.
function makeShade() {
  document.querySelectorAll('.shade i').forEach((el, n) => {
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = 400;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 640, 400);
    x.fillStyle = 'rgba(20,42,38,0.13)';
    for (let b = 0; b < 3; b++) {
      let px = n ? 670 : -30,
        py = rnd(-30, 150),
        dir = n ? Math.PI - rnd(0.2, 0.75) : rnd(0.2, 0.75);
      for (let st = 0; st < 12; st++) {
        px += Math.cos(dir) * 34;
        py += Math.sin(dir) * 34;
        dir += rnd(-0.22, 0.22);
        for (let l = 0; l < 6; l++) {
          x.beginPath();
          x.ellipse(px + rnd(-48, 48), py + rnd(-48, 48), rnd(12, 34), rnd(6, 15), rnd(0, 3.14), 0, 6.2832);
          x.fill();
        }
      }
    }
    el.style.backgroundImage = `url(${cv.toDataURL()})`;
  });
}

/* ================= the focus: which depth is sharp ================= */
// 0 is the surface, 1 the bed. The wheel over open water pulls it, and so does the scale at the edge.
let focus = 0.6,
  focusGoal = 0.6,
  focusLive = 0;
function setFocus(v) {
  focusGoal = clamp(v, 0, 1);
  focusLive = T + 1.4;
  $('#gauge').setAttribute('aria-valuenow', Math.round(focusGoal * 100));
  $('#gauge').setAttribute('aria-valuetext', focusGoal < 0.3 ? 'the surface' : focusGoal < 0.78 ? 'the koi' : 'the bed');
}
pond.addEventListener(
  'wheel',
  (e) => {
    if (e.target.closest('.glass, .veil, .pal-wrap, .mock-pop')) return;
    e.preventDefault();
    setFocus(focusGoal + e.deltaY * 0.0014);
  },
  { passive: false }
);
{
  const g = $('#gauge'),
    at = (e) => {
      const r = g.getBoundingClientRect();
      setFocus((e.clientY - r.top) / r.height);
    };
  g.addEventListener('pointerdown', (e) => {
    g.setPointerCapture(e.pointerId);
    at(e);
    e.stopPropagation();
  });
  g.addEventListener('pointermove', (e) => {
    if (g.hasPointerCapture(e.pointerId)) at(e);
  });
  g.addEventListener('keydown', (e) => {
    const d = { ArrowUp: -0.08, ArrowDown: 0.08, Home: -1, End: 1 }[e.key];
    if (d) {
      e.preventDefault();
      e.stopPropagation();
      setFocus(focusGoal + d);
    }
  });
}

/* ================= what the panes hold ================= */
const PHOTOS = D.photos;
let NOTES = [];
const PLAY = '<svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 1v10l8-5z"/></svg>';
const markSrc = (m) => `/pond/marks/${m}.png`;
function fillPanes() {
  // the row for the timeline carries the marks of the places worked at, newest first
  $('#tocWork').innerHTML = `<span class="marks">${LOG.filter((e) => e.kind === 'role')
    .map((e) => `<img src="${markSrc(e.mark)}" alt="${esc(e.title)}" style="background:${e.mark === 'tiktok' ? '#000' : '#fff'}">`)
    .join('')}</span>`;
  $('#tocWorkN').textContent = LOG.length;
  $('#mosaic').innerHTML = PHOTOS.slice(0, 4)
    .map((p) => `<img src="${p.thumb}" alt="" loading="lazy">`)
    .join('');
  $('#photoMore').textContent = PHOTOS.length;
  fillNotes();
  fillMusic();
}
function fillNotes() {
  $('#noteLast').textContent = NOTES.length ? NOTES[0].body : 'Leave the first line';
  $('#noteCount').textContent = NOTES.length || '';
  const all = $('#noteAll');
  if (all) all.innerHTML = notesHtml();
}
const notesHtml = () =>
  NOTES.map((n) => `<li><q>${esc(n.body)}</q><em>${esc(n.name)}, ${esc(ago(n.created_at))}</em></li>`).join('') || '<li class="empty">No boats yet.</li>';
function ago(iso) {
  const m = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
  return m < 1
    ? 'just now'
    : m < 60
      ? `${Math.round(m)} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fillMusic() {
  const m = music(),
    song = m.songs[m.index];
  $('#npTitle').textContent = song ? song.title : m.ready ? '' : '…';
  $('#npWho').textContent = song ? song.artist : '';
  $('#songMore').textContent = m.songs.length || '';
  $('#play').setAttribute('aria-pressed', String(m.playing));
  $('#play').setAttribute('aria-label', m.playing ? 'Pause music' : 'Play music');
  $('#playIcon').innerHTML = m.playing ? '<path d="M2 1h3v10H2zM7 1h3v10H7z"/>' : '<path d="M2.5 1v10l8-5z"/>';
  $('#bars').toggleAttribute('data-on', m.playing);
  const list = $('#songList');
  if (list) list.querySelectorAll('li[data-i]').forEach((li) => li.toggleAttribute('data-now', +li.dataset.i === m.index));
  const cov = $('#nowCover');
  if (cov && song) {
    cov.src = coverOf(song);
    $('#nowTitle').textContent = song.title;
    $('#nowWho').textContent = song.artist;
  }
}
// a row of the contents opens its chapter wherever it is pressed
$('#toc').addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  const row = e.target.closest('.row');
  if (row) row.querySelector('.go').click();
});

/* ================= a section opened ================= */
// The career: roles, schools and projects in one stream, newest first. `s` is when each began, as a
// year with a fraction; its depth on the staff is how long ago that was.
const TODAY = (() => {
  const d = new Date();
  return d.getFullYear() + d.getMonth() / 12;
})();
const LOG = D.log;
const PROJECTS = LOG.filter((e) => e.kind === 'project');
const depthOf = (e) => (Math.max(0, TODAY - e.s) * 0.45).toFixed(1);
const entry = (
  e
) => `<li id="p-${e.id}" data-kind="${e.kind}" data-depth="${depthOf(e)}" data-year="${Math.floor(e.s)}"><span class="depth"><b>${Math.floor(e.s)}</b>${depthOf(e)} m</span>${e.mark ? `<i class="node mark${e.kind === 'project' ? ' full' : ''}" style="--bg:${e.mark === 'tiktok' ? '#000' : '#fff'}"><img src="${markSrc(e.mark)}" alt=""></i>` : `<i class="node" style="--c:${e.c || 'none'}"></i>`}
  <h3>${esc(e.title)}${e.tag ? `<small>${esc(e.tag)}</small>` : ''}<span class="meta">${esc(e.when)}</span></h3>
  ${e.role ? `<p class="role">${esc(e.role)}${e.place ? ` <span>·</span> ${esc(e.place)}` : ''}</p>` : ''}${e.text ? `<p class="txt">${esc(e.text)}</p>` : ''}
  ${e.pts ? `<ul class="pts">${e.pts.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}${e.cover ? (e.visit ? `<a class="cover" href="${e.visit}" target="_blank" rel="noopener" aria-label="Open ${esc(e.title)}">` : '<div class="cover">') + `<img src="${e.cover}" alt="" loading="lazy">` + (e.visit ? '</a>' : '</div>') : ''}${
    e.stack
      ? `<div class="stack">${e.stack
          .split(' · ')
          .map((x) => `<span>${esc(x)}</span>`)
          .join('')}</div>`
      : ''
  }
  ${e.ref ? `<button class="ref" data-goto="${e.ref[0]}" style="--c:${(PROJECTS.find((p) => p.id === e.ref[0]) || {}).c}">${esc(e.ref[1])} <span aria-hidden="true">↑</span></button>` : ''}
  ${e.source ? `<div class="links">${e.visit ? `<a class="link" href="${e.visit}" target="_blank" rel="noopener">Visit ↗</a>` : ''}<a class="link" href="${e.source}" target="_blank" rel="noopener">Source ↗</a></div>` : ''}</li>`;
const monthOf = (p) => new Date(p.taken).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const KINDS = [
  ['all', 'All'],
  ['role', 'Roles'],
  ['project', 'Projects'],
  ['school', 'School']
];
let logKind = 'all',
  logCompact = false;
const SHEETS = {
  career:
    () => `<h1>Soundings</h1><p class="lede">Work, projects and school on one line, newest at the surface. Scroll, and the pond's focus sinks with you to the bed.</p>
    <div class="filt" role="toolbar" aria-label="Show">${KINDS.map(([k, l]) => `<button data-kind="${k}">${l}<em>${k === 'all' ? LOG.length : LOG.filter((e) => e.kind === k).length}</em></button>`).join('')}<span class="gap"></span>
      <button data-view="detail" aria-label="In full"><svg width="14" height="14" viewBox="0 0 14 14" stroke-width="1.3" stroke-linecap="round"><rect x="1.5" y="2" width="4" height="4" rx="1"/><path d="M8 3h4.5M8 5h3M1.5 9.5h11M1.5 12h8"/></svg></button>
      <button data-view="list" aria-label="Titles only"><svg width="14" height="14" viewBox="0 0 14 14" stroke-width="1.3" stroke-linecap="round"><path d="M1.5 3h11M1.5 7h11M1.5 11h11"/></svg></button></div>
    <ol class="sound" id="sound">${LOG.map(entry).join('')}<li class="bed" data-kind="bed" data-depth="${depthOf(LOG[LOG.length - 1])}" data-year="${Math.floor(LOG[LOG.length - 1].s)}"><span class="depth">bed</span><i class="node"></i><p class="role">The bed. Everything above settled on this.</p></li></ol>`,
  about: () => `<h1>Hey, I'm Jincheng.</h1><div class="prose">${D.about.map((p) => `<p>${chips(p)}</p>`).join('')}
    <div class="links"><a class="link" href="https://github.com/jma49" target="_blank" rel="noopener">GitHub ↗</a><button class="link" data-sheet="career">Timeline</button><a class="link" href="/">The old desktop</a></div></div>
    <p class="fine" id="letterTime"></p>`,
  music: () => {
    const m = music(),
      song = m.songs[m.index];
    return `<h1>What's on</h1><p class="lede">The songs I keep coming back to. They play here as they do on my old desktop, and the pond's sound switch turns them down too.</p>
    ${song ? `<div class="now-song"><img id="nowCover" src="${coverOf(song)}" alt=""><div><b id="nowTitle">${esc(song.title)}</b><span id="nowWho">${esc(song.artist)}</span></div></div>` : ''}
    <ul class="rows songs" id="songList">${m.songs.map((t, i) => `<li data-i="${i}" ${i === m.index ? 'data-now' : ''}><button data-song="${i}" aria-label="Play ${esc(t.title)}">${PLAY}</button><b>${esc(t.title)}</b><span class="who">${esc(t.artist)}</span></li>`).join('') || '<li class="empty">The songs are on their way.</li>'}</ul>`;
  },
  photos:
    () => `<h1>${PHOTOS.length} photographs</h1><p class="lede">Newest first, from <a href="${D.unsplash}" target="_blank" rel="noopener">Unsplash</a>. Press one to see it large; the arrow keys move through them.</p>
    <div class="shots just">${PHOTOS.map((p, i) => `<a href="${p.page}" data-i="${i}" style="--ar:${(p.w / p.h).toFixed(3)};background:${p.color}" aria-label="Photograph, ${monthOf(p)}"><img src="${p.thumb}" alt="${esc(p.alt)}" loading="lazy"><span>${monthOf(p)}</span></a>`).join('')}</div>`,
  notes:
    () => `<h1>Paper boats</h1><p class="lede">The guestbook. Leave a line, a few a day; it sails off across the pond as a boat, and whoever comes by can read it.</p>
    ${noteForm()}<ul class="notes" id="noteAll">${notesHtml()}</ul>`,
  chat: () => `<h1>Chat</h1><p class="lede" id="chatWho"></p><div class="rooms" id="rooms" role="tablist" aria-label="Rooms"></div>
    <ol class="chat" id="chatLog" aria-live="polite"></ol>
    ${me ? `<form class="noteform chatform"><input maxlength="500" placeholder="Say something to the room" autocomplete="off" aria-label="Your message"><button aria-label="Send"><svg width="15" height="15" viewBox="0 0 16 16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button></form>` : signInFirst('to talk')}`,
  account: () =>
    me
      ? `<h1>${esc(me.username)}</h1><p class="lede">Signed in. Your koi carries your name, and you can leave notes and talk in the chat.</p><div class="links"><button class="link" data-act="signout">Sign out</button></div>`
      : `<h1>${signingUp ? 'Make an account' : 'Sign in'}</h1><p class="lede">${signingUp ? 'A username and a password; the recovery address is optional.' : 'The same account as on the old desktop.'}</p>
    <form class="acct" data-mode="${signingUp ? 'up' : 'in'}"><label>Username<input name="u" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+"></label>
      <label>Password<input name="p" type="password" autocomplete="${signingUp ? 'new-password' : 'current-password'}" required minlength="6"></label>
      ${signingUp ? '<label>Recovery address <small>(optional)</small><input name="e" type="email" autocomplete="email"></label>' : ''}
      <p class="err" id="acctErr" role="alert"></p>
      <div class="links"><button class="link main">${signingUp ? 'Make the account' : 'Sign in'}</button><button type="button" class="link" data-act="switch">${signingUp ? 'I have an account' : 'Make an account'}</button></div></form>`
};
const chips = (p) =>
  p
    .replace(/\{work:(\w+)\}/g, (_, id) => {
      const e = PROJECTS.find((x) => x.id === id);
      return e ? `<button class="chip mk" data-sheet="work" data-focus="${id}"><img src="${markSrc(e.mark)}" alt="">${esc(e.title)}</button>` : id;
    })
    .replace('{photos}', '<button class="chip" data-sheet="photos" style="--c:#6fb9cc">photos</button>');
const signInFirst = (why) =>
  accountsOpen
    ? `<p class="signin"><button class="link main" data-sheet="account">Sign in</button> <span>${why}.</span></p>`
    : '<p class="signin"><span>Signing in isn’t open on this copy of the site.</span></p>';
const noteForm = () =>
  me
    ? `<form class="noteform"><input maxlength="280" placeholder="Leave a line" autocomplete="off" aria-label="Your note"><button aria-label="Launch the note"><svg width="15" height="15" viewBox="0 0 16 16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button></form>`
    : signInFirst('to leave one');
let me = null,
  accountsOpen = false,
  signingUp = false;
const ORDER = ['about', 'career', 'photos', 'music', 'notes', 'chat'];
const CHAPTERS = {
  about: ['00', 'About'],
  career: ['01', 'Timeline'],
  resume: ['01', 'Timeline'],
  work: ['01', 'Timeline'],
  photos: ['02', 'Photos'],
  music: ['03', 'Music'],
  notes: ['04', 'Notes'],
  chat: ['05', 'Chat'],
  account: ['', 'Account']
};
// Which entries show, and which of them is the first of its year (it carries the year on the staff).
function applyLog() {
  const ol = $('#sound');
  if (!ol) return;
  let year = '';
  ol.toggleAttribute('data-compact', logCompact);
  for (const li of ol.children) {
    li.hidden = logKind !== 'all' && li.dataset.kind !== logKind && li.dataset.kind !== 'bed';
    if (!li.hidden && li.dataset.kind !== 'bed') {
      li.toggleAttribute('data-newyear', li.dataset.year !== year);
      year = li.dataset.year;
    }
  }
  $('#sheet')
    .querySelectorAll('[data-kind]')
    .forEach((b) => {
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.kind === logKind));
    });
  $('#sheet')
    .querySelectorAll('[data-view]')
    .forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.view === 'list') === logCompact)));
  sound();
}
// Reading down the career sinks the pond's focus with it, and the reading in the header follows the entry under the eye.
function sound() {
  const el = $('#scroll');
  if (!el || !$('#sound')) return;
  const room = el.scrollHeight - el.clientHeight,
    line = el.getBoundingClientRect().top + el.clientHeight * 0.34;
  let cur = null;
  setFocus(0.1 + (room > 8 ? clamp(el.scrollTop / room, 0, 1) : 0) * 0.9);
  for (const li of $('#sound').children) if (!li.hidden && li.getBoundingClientRect().top <= line) cur = li;
  $('#readout').textContent = cur ? `↓ ${cur.dataset.depth} m · ${cur.dataset.year}` : '↓ 0.0 m · today';
}
function showRow(at) {
  const row = at && $('#p-' + at),
    el = $('#scroll');
  if (!row) return;
  el.scrollTo({
    top: el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight * 0.3,
    behavior: RM ? 'auto' : 'smooth'
  });
  row.dataset.focus = '';
  setTimeout(() => delete row.dataset.focus, 1600);
}
let lastFocus = null;
const sheetOpen = () => 'open' in $('#veil').dataset;
function openSheet(id, at) {
  const wasOpen = sheetOpen();
  if (!wasOpen) {
    lastFocus = document.activeElement;
    focusWas = focusGoal;
  }
  const [no, name] = CHAPTERS[id],
    log = id === 'career' || id === 'resume' || id === 'work',
    wide = id === 'photos' ? 'full' : '';
  if (log) logKind = id === 'resume' ? 'role' : id === 'work' && !at ? 'project' : 'all';
  viewAt = -1;
  $('#sheet').innerHTML =
    `<header class="head"><p class="eyebrow">${name}</p><span class="read" id="readout"></span><nav class="chap" aria-label="Chapters">${ORDER.map((k) => `<button data-sheet="${k}" aria-label="${CHAPTERS[k][1]}" ${CHAPTERS[k][0] === no ? 'aria-current="true"' : ''}>${+CHAPTERS[k][0]}</button>`).join('')}</nav><button class="x" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></header><div class="scroll" id="scroll">${SHEETS[log ? 'career' : id]()}</div>` +
    (id === 'photos'
      ? '<div class="view" id="view" hidden><button class="vx" aria-label="Close the photograph"><svg width="12" height="12" viewBox="0 0 12 12" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg></button><button class="vs" data-step="-1" aria-label="Previous">‹</button><img id="viewImg" alt="Photo by Jincheng Ma"><button class="vs" data-step="1" aria-label="Next">›</button><p><span id="viewCap"></span><a class="link" id="viewLink" target="_blank" rel="noopener">Open on Unsplash ↗</a></p></div>'
      : '');
  if (wide) $('#sheet').dataset.wide = wide;
  else delete $('#sheet').dataset.wide;
  $('#sheet').setAttribute('aria-label', name);
  $('#veil').dataset.open = '';
  pond.dataset.chapter = wide ? 'wide' : 'side';
  $('#sheet').focus({ preventScroll: true });
  sheetFor = log || id === 'work' ? at || '' : '';
  // the water takes the pane's arrival, and the address names where one is
  if (!wasOpen) {
    const r = $('#sheet').getBoundingClientRect(),
      pr = pond.getBoundingClientRect();
    drop(clamp(r.right - pr.left + 26, 20, W - 20), H * 0.5, 5, 0.7);
  }
  try {
    history.replaceState(null, '', '#' + id + (at ? '/' + at : ''));
  } catch (err) {
    /* a page that may not rewrite its address still opens the chapter */
  }
  stirTop = 0;
  $('#scroll').addEventListener('scroll', stir, { passive: true });
  if (log) applyLog();
  else if (id === 'about') tick();
  else if (id === 'chat') openChat();
  else if (id === 'notes') void people.readNotes();
  else if (id === 'music') void loadSongs();
  if (id !== 'chat') closeChat();
  if (log || id === 'work') showRow(at);
}
// Reading down any chapter sinks the pond's focus with it, and the scrolling itself stirs the water beside the sheet.
let stirAt = 0,
  stirTop = 0;
function stir() {
  const el = $('#scroll');
  if (!el) return;
  const room = el.scrollHeight - el.clientHeight,
    p = room > 8 ? clamp(el.scrollTop / room, 0, 1) : 0;
  setFocus(0.1 + p * 0.9);
  if (T - stirAt > 0.14) {
    const moved = Math.abs(el.scrollTop - stirTop),
      r = $('#sheet').getBoundingClientRect(),
      pr = pond.getBoundingClientRect();
    stirTop = el.scrollTop;
    stirAt = T;
    if (moved > 2 && !RM)
      drop(clamp(r.right - pr.left + rnd(16, 74), 10, W - 10), clamp(H * (0.12 + 0.76 * p) + rnd(-34, 34), 10, H - 10), 2.4, clamp(moved * 0.006, 0.12, 0.8));
  }
  sound();
}
// one photograph, large, over its sheet
let viewAt = -1;
const viewOpen = () => viewAt >= 0;
function showPhoto(i) {
  const v = $('#view');
  if (!v) return;
  viewAt = (i + PHOTOS.length) % PHOTOS.length;
  v.hidden = false;
  const p = PHOTOS[viewAt];
  $('#viewImg').src = p.full;
  $('#viewImg').alt = p.alt;
  $('#viewCap').textContent = `${monthOf(p)} · ${viewAt + 1} / ${PHOTOS.length}`;
  $('#viewLink').href = p.page;
}
function closeView() {
  const v = $('#view');
  if (v) v.hidden = true;
  viewAt = -1;
}
let focusWas = null;
let sheetFor = '';
function closeSheet() {
  if (!sheetOpen()) return;
  closeView();
  closeChat();
  delete $('#veil').dataset.open;
  delete pond.dataset.chapter;
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  if (focusWas !== null) {
    setFocus(focusWas);
    focusWas = null;
  }
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (err) {
    /* as above: the address is a nicety */
  }
  // whoever belongs to the project just read comes by once the sheet is out of the way
  if (sheetFor === 'devot') setTimeout(callDove, 500);
  else if (sheetFor === 'ocra')
    setTimeout(() => {
      dropBug();
      dropBug();
    }, 500);
  sheetFor = '';
}
function playSong(i) {
  audio();
  void playSongAt(i);
}
$('#veil').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === $('#veil')) closeSheet();
});
$('#sheet').addEventListener('click', (e) => {
  const kind = e.target.closest('button[data-kind]'),
    view = e.target.closest('[data-view]'),
    go = e.target.closest('[data-goto]'),
    shot = e.target.closest('.shots.just a'),
    step = e.target.closest('[data-step]');
  if (e.target.closest('.vx') || e.target.id === 'view') closeView();
  else if (step) showPhoto(viewAt + +step.dataset.step);
  else if (shot && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    showPhoto(+shot.dataset.i);
  } else if (e.target.closest('.x')) closeSheet();
  else if (kind) {
    logKind = kind.dataset.kind;
    applyLog();
  } else if (view) {
    logCompact = view.dataset.view === 'list';
    applyLog();
  } else if (go) {
    logKind = 'all';
    applyLog();
    showRow(go.dataset.goto);
  } else if (e.target.closest('[data-act=switch]')) {
    signingUp = !signingUp;
    openSheet('account');
  } else if (e.target.closest('[data-act=signout]'))
    void people.signOut().then(
      () => openSheet('account'),
      (err) => report(err, 'pond sign out')
    );
  else if (e.target.closest('[data-room]')) {
    chatRoom = e.target.closest('[data-room]').dataset.room;
    void drawChat();
  }
});
// anything, anywhere, that names a section or a song
pond.addEventListener('click', (e) => {
  if (e.target.closest('#play')) return;
  const s = e.target.closest('[data-sheet]'),
    g = e.target.closest('[data-song]');
  if (s) openSheet(s.dataset.sheet, s.dataset.focus);
  else if (g) playSong(+g.dataset.song);
});
pond.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.classList.contains('acct')) return void account(form);
  const box = form.querySelector('input'),
    v = box.value.trim();
  if (!v || form.dataset.busy) return;
  form.dataset.busy = '';
  const done = () => {
    delete form.dataset.busy;
  };
  if (form.classList.contains('chatform')) {
    people.sendChat(chatRoom, v).then(
      () => {
        box.value = '';
        done();
      },
      (err) => {
        done();
        say(err, 'Your message didn’t go through.');
      }
    );
    return;
  }
  people.postNote(v).then(
    () => {
      box.value = '';
      done();
      fillNotes();
      // the boat puts out from the side of the form that faces open water
      const r = form.getBoundingClientRect(),
        pr = pond.getBoundingClientRect(),
        mid = r.left + r.width / 2 - pr.left;
      launchBoat(v, me ? me.username : '', [
        clamp(mid > W / 2 ? r.left - pr.left - 50 : r.right - pr.left + 50, 30, W - 30),
        clamp(r.top - pr.top + 10, 30, H - 30)
      ]);
      audio();
      plip('drop');
    },
    (err) => {
      done();
      say(err, 'The note didn’t go up.');
    }
  );
});
// What went wrong, said where it happened: the backend's own words when it refuses, ours otherwise.
function say(err, fallback) {
  const refused = err instanceof SocialError,
    msg = refused ? err.message : fallback;
  if (!refused) report(err, 'pond');
  const el = $('#sheet .err') || Object.assign(document.createElement('p'), { className: 'err' });
  el.textContent = msg;
  if (!el.isConnected) {
    const f = $('#sheet form');
    if (f) f.after(el);
  }
}
function account(form) {
  const f = new FormData(form),
    u = String(f.get('u') || ''),
    p = String(f.get('p') || ''),
    e = String(f.get('e') || '');
  if (form.dataset.busy) return;
  form.dataset.busy = '';
  (form.dataset.mode === 'up' ? people.signUp(u, p, e) : people.signIn(u, p)).then(
    () => {
      signingUp = false;
      openSheet('account');
    },
    (err) => {
      delete form.dataset.busy;
      say(err, 'That didn’t work. Try again in a moment.');
    }
  );
}
/* ================= the chat ================= */
let chatRoom = 'lobby',
  chatStop = null,
  chatSeen = 0,
  chatLog = [];
async function openChat() {
  const r = await people.rooms();
  const el = $('#rooms');
  if (!el) return;
  el.innerHTML = r.map((x) => `<button role="tab" data-room="${esc(x.id)}" aria-selected="${x.id === chatRoom}">${esc(x.name)}</button>`).join('');
  $('#chatWho').textContent = me ? `You're ${me.username}. Be kind; everyone here can read it.` : 'Anyone can read along; members can talk.';
  void drawChat();
  if (!chatStop)
    chatStop = await people.watchChat(
      (m) => {
        if (m.room === chatRoom) {
          chatLog.push(m);
          paintChat();
        } else if (!sheetOpen()) chatUnread(true);
      },
      (id) => {
        chatLog = chatLog.filter((m) => m.id !== id);
        paintChat();
      }
    );
}
async function drawChat() {
  $('#rooms') &&
    $('#rooms')
      .querySelectorAll('[data-room]')
      .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.room === chatRoom)));
  try {
    chatLog = await people.readChat(chatRoom);
  } catch (err) {
    report(err, 'pond chat');
    chatLog = [];
  }
  paintChat();
  chatUnread(false);
}
function paintChat() {
  const ol = $('#chatLog');
  if (!ol) return;
  ol.innerHTML =
    chatLog
      .map(
        (m) =>
          `<li${me && m.user_id === me.id ? ' data-me' : ''}><b>${esc(m.username)}</b><span>${esc(m.body)}</span><time>${esc(ago(m.created_at))}</time></li>`
      )
      .join('') || '<li class="empty">Nothing said here yet.</li>';
  const sc = $('#scroll');
  if (sc) sc.scrollTop = sc.scrollHeight;
}
function closeChat() {
  if (chatStop) {
    chatStop();
    chatStop = null;
  }
}
function chatUnread(on) {
  chatSeen = on ? chatSeen + 1 : 0;
  $('#talk').toggleAttribute('data-new', chatSeen > 0);
}

/* ================= the letter ================= */
// Nothing lies over the pond any more: these stay so that everything that used to ask about the letter still can.
const letterOpen = () => false,
  putDown = () => {},
  openLetter = () => openSheet('about');
let arrived = false;
$('#inkBtn').addEventListener('click', (e) => setInk(!inkOn, e.currentTarget));
function setClear(on) {
  pond.toggleAttribute('data-clear', on);
  $('#clear').setAttribute('aria-pressed', String(!on));
  $('#clear').setAttribute('aria-label', on ? 'Show the glass' : 'Hide the glass');
}
$('#clear').addEventListener('click', () => {
  if (letterOpen()) putDown();
  setClear(!('clear' in pond.dataset));
});

/* ================= the command bar ================= */
const ICONS = {
  letter: '<path d="M2.5 4h11v8.5h-11z"/><path d="m2.5 4.5 5.5 4.5 5.5-4.5"/>',
  doc: '<path d="M4 2h5.5L12 4.5V14H4z"/><path d="M6 7.5h4M6 10h4"/>',
  photo: '<rect x="2" y="3" width="12" height="10" rx="2"/><circle cx="6" cy="7" r="1.3"/><path d="m3 12 3.5-3 2.5 2 2-1.5 2.5 2"/>',
  note: '<path d="M2 9.5h12l-2.5 3h-7z"/><path d="M8 2.5v7M8 3.5l3.5 4H8"/>',
  music: '<path d="M6 12V4l6-1.5V10"/><circle cx="4.6" cy="12" r="1.5"/><circle cx="10.6" cy="10" r="1.5"/>',
  play: '<path d="M5 3.5v9l7-4.5z"/>',
  food: '<circle cx="5" cy="6" r="1.2"/><circle cx="10.5" cy="5" r="1.2"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="10.5" r="1"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3"/>',
  moon: '<path d="M12.5 9.5A5.5 5.5 0 0 1 6.5 3.5a5.5 5.5 0 1 0 6 6z"/>',
  rain: '<path d="M4.5 9.5a3 3 0 0 1 .4-6 3.6 3.6 0 0 1 6.8 1 2.5 2.5 0 0 1-.3 5z"/><path d="M5.5 11.5 5 13M8.2 11.5 7.7 13M11 11.5l-.5 1.5"/>',
  brush: '<path d="M13.5 2.5 7 9"/><path d="M7 9c-1.6-.5-3.4.5-3.6 2.4-.1 1.2-.7 1.9-1.4 2.1 2.6.6 5.6-.1 5.9-2.6z"/>',
  glass: '<rect x="2" y="3" width="8.5" height="7" rx="2"/><path d="M12.6 6.2A2 2 0 0 1 14 8.1V11a2 2 0 0 1-2 2H7.6a2 2 0 0 1-1.9-1.4"/>',
  sound: '<path d="M2.5 6.2h2.6L8.6 3.5v9L5.1 9.8H2.5z"/><path d="M11 5.6a3.4 3.4 0 0 1 0 4.8"/>',
  chat: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>',
  user: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 13.5c.8-2.6 2.7-3.8 5-3.8s4.2 1.2 5 3.8"/>',
  again: '<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M3 3v3h3"/>'
};
const ico = (n) => `<svg width="16" height="16" viewBox="0 0 16 16" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
// Everything the pond can do or show, as one list: label, a line about it, the keys that find it.
function commands() {
  const cleared = 'clear' in pond.dataset;
  return [
    { sec: 'Go to', icon: 'letter', label: 'About me', hint: 'Who I am, in four paragraphs', kw: 'about hello jincheng who bio', top: true, run: openLetter },
    ...PROJECTS.map((p) => ({
      sec: 'Go to',
      dot: p.c,
      label: p.title,
      hint: `${p.tag}, ${p.when}`,
      kw: 'work project ' + p.text,
      run: () => openSheet('work', p.id)
    })),
    {
      sec: 'Go to',
      icon: 'doc',
      label: 'Timeline',
      hint: 'TikTok, INFI.US, Carrefour China, and what I built',
      kw: 'resume cv experience jobs career hire work projects school',
      run: () => openSheet('career')
    },
    {
      sec: 'People',
      icon: 'chat',
      label: 'Chat',
      hint: online ? `${online} here now` : 'The room everyone shares',
      kw: 'chat talk message room people',
      top: true,
      run: () => openSheet('chat')
    },
    ...(accountsOpen
      ? [
          me
            ? {
                sec: 'People',
                icon: 'user',
                label: 'Sign out',
                hint: `Signed in as ${me.username}`,
                kw: 'account logout leave',
                cmd: true,
                run: () => void people.signOut()
              }
            : {
                sec: 'People',
                icon: 'user',
                label: 'Sign in',
                hint: 'Or make an account: your koi carries your name',
                kw: 'account login register signup member',
                top: true,
                cmd: true,
                run: () => {
                  signingUp = false;
                  openSheet('account');
                }
              }
        ]
      : []),
    {
      sec: 'Go to',
      icon: 'photo',
      label: 'Photos',
      hint: `${PHOTOS.length} photographs`,
      kw: 'pictures unsplash camera gallery',
      run: () => openSheet('photos')
    },
    {
      sec: 'Go to',
      icon: 'note',
      label: 'Leave a note',
      hint: 'It sails off as a paper boat',
      kw: 'guestbook boat write message notes',
      top: true,
      run: () => {
        setClear(false);
        if (letterOpen()) putDown();
        openSheet('notes');
        setTimeout(() => {
          const box = $('#sheet').querySelector('input');
          if (box) box.focus({ preventScroll: true });
        }, 80);
      }
    },
    {
      sec: 'Music',
      icon: 'play',
      label: music().playing ? 'Pause the music' : 'Play the music',
      hint: music().songs[music().index] ? `${music().songs[music().index].title} · ${music().songs[music().index].artist}` : 'The songs I keep coming back to',
      kw: 'music song sound play pause stop',
      top: true,
      cmd: true,
      run: () => {
        audio();
        void toggleSong();
      }
    },
    ...music().songs.map((t, i) => ({
      sec: 'Music',
      icon: 'music',
      label: t.title,
      hint: t.artist,
      kw: 'song play music ' + t.artist + ' ' + (t.album || '') + ' ' + (t.original || ''),
      run: () => playSong(i)
    })),
    ...[
      ['Spring', 4.3, '清明 · petals on the water'],
      ['Summer', 11.2, '大暑 · lotus and dragonflies'],
      ['Autumn', 17.2, '霜降 · leaves come down'],
      ['Winter', 22.6, '小寒 · ice and snow']
    ].map(([l, y, h]) => ({ sec: 'Year', icon: 'sun', label: l, hint: h, kw: 'season year time ' + l, cmd: true, run: () => setYear(y) })),
    {
      sec: 'Year',
      icon: 'again',
      label: 'Follow the calendar',
      hint: `Today: ${TERMS[Math.floor(yearToday())][0]} · ${TERMS[Math.floor(yearToday())][1]}`,
      kw: 'season year today auto solar term',
      cmd: true,
      run: () => setYear()
    },
    ...[
      ['the surface', 0.05, 'Reflections, pads and petals'],
      ['the koi', 0.6, 'Where it rests'],
      ['the bed', 1, 'The stones']
    ].map(([l, v, h]) => ({
      sec: 'Pond',
      icon: 'glass',
      label: 'Focus on ' + l,
      hint: h,
      kw: 'focus depth sharp blur ' + l,
      cmd: true,
      run: () => setFocus(v)
    })),
    {
      sec: 'Pond',
      icon: 'letter',
      label: "Call Devot's dove",
      hint: 'It comes down on a lily pad to drink',
      kw: 'devot pigeon bird dove visitor',
      cmd: true,
      run: () => {
        if (letterOpen()) putDown();
        setClear(false);
        callDove();
      }
    },
    {
      sec: 'Pond',
      icon: 'food',
      label: "Drop a bug for ocra's spider",
      hint: 'It watches, then it jumps',
      kw: 'ocra spider bug insect review jump',
      cmd: true,
      run: () => {
        if (letterOpen()) putDown();
        dropBug();
        dropBug();
      }
    },
    {
      sec: 'Pond',
      icon: 'food',
      label: 'Feed the fish',
      hint: 'Or press the water anywhere',
      key: 'F',
      kw: 'food pellets koi feed',
      top: true,
      cmd: true,
      run: feedMiddle
    },
    {
      sec: 'Pond',
      icon: 'glass',
      label: cleared ? 'Show the glass' : 'Hide the glass',
      hint: cleared ? 'Bring the panes back' : 'Only the pond',
      key: 'G',
      kw: 'glass panes cards hide show clear pond only',
      cmd: true,
      run: () => {
        if (letterOpen()) putDown();
        setClear(!cleared);
      }
    },
    {
      sec: 'Pond',
      icon: 'brush',
      label: inkOn ? 'Back to the water' : 'Ink and paper',
      hint: 'The pond as an ink painting, in slow motion',
      key: 'I',
      kw: 'ink paper painting chinese brush black white slow 水墨',
      top: true,
      cmd: true,
      run: () => setInk(!inkOn)
    },
    {
      sec: 'Pond',
      icon: 'rain',
      label: raining ? 'Stop the rain' : 'Make it rain',
      hint: 'Weather',
      kw: 'rain weather storm',
      cmd: true,
      run: () => {
        raining = !raining;
        tick();
      }
    },
    ...[
      ['dawn', 'Dawn', 'sun'],
      ['day', 'Day', 'sun'],
      ['dusk', 'Dusk', 'sun'],
      ['night', 'Night', 'moon']
    ].map(([p, l, i]) => ({
      sec: 'Pond',
      icon: i,
      label: l,
      hint: 'Time of day',
      kw: 'time light ' + p,
      cmd: true,
      run: () => {
        setPhase(p);
        tick();
      }
    })),
    {
      sec: 'Pond',
      icon: 'sun',
      label: 'Follow my clock',
      hint: 'Time of day',
      kw: 'auto time now reset',
      cmd: true,
      run: () => {
        setPhase('auto');
        tick();
      }
    },
    {
      sec: 'Pond',
      icon: 'sound',
      label: muted ? 'Turn the sound on' : 'Turn the sound off',
      hint: 'The water, the fish and the music',
      key: 'M',
      kw: 'mute audio volume quiet',
      cmd: true,
      run: () => {
        audio();
        setMuted(!muted);
      }
    },
    { sec: 'Pond', icon: 'again', label: 'Replay the opening', hint: 'The greeting and the gold koi', kw: 'intro again restart', cmd: true, run: () => intro() }
  ];
}
// A label matches when it holds the query whole, or when the query's letters each start a word
// or follow the letter before (so "wf" finds White Ferrari, and "oc" does not find "clock").
function fuzzy(q, text) {
  const t = text.toLowerCase(),
    whole = t.indexOf(q),
    start = (i) => i === 0 || /[\s·,'-]/.test(t[i - 1]);
  if (whole >= 0) return { score: 100 - whole * 2 + (start(whole) ? 30 : 0) - t.length * 0.05, at: [...q].map((_, k) => whole + k) };
  const at = [];
  let from = 0;
  for (const ch of q) {
    let f = -1;
    if (at.length && t[from] === ch) f = from;
    else
      for (let i = from; i < t.length; i++)
        if (t[i] === ch && start(i)) {
          f = i;
          break;
        }
    if (f < 0) return null;
    at.push(f);
    from = f + 1;
  }
  return { score: 50 - at[0] * 2 - t.length * 0.05, at };
}
// Beyond the label, a command is found by a word of its description or its keywords.
const worded = (q, text) => {
  const ws = text.toLowerCase().split(/[\s·,]+/);
  return ws.some((w) => w.startsWith(q)) ? 12 : q.length > 2 && ws.some((w) => w.includes(q)) ? 4 : 0;
};
const lit = (text, at) => {
  const set = new Set(at);
  return [...text].map((ch, i) => (set.has(i) ? `<mark>${esc(ch)}</mark>` : esc(ch))).join('');
};
let hits = [],
  sel = 0,
  palFocus = null;
function drawPal() {
  const raw = $('#palIn').value,
    only = raw.startsWith('/'),
    q = raw.replace(/^\//, '').trim().toLowerCase(),
    all = commands().filter((c) => !only || c.cmd);
  let html = '';
  if (!q) {
    const groups = only
      ? [['Commands', all]]
      : [['Suggested', all.filter((c) => c.top)], ...['Go to', 'People', 'Music', 'Year', 'Pond'].map((s) => [s, all.filter((c) => c.sec === s && !c.top)])];
    hits = groups.flatMap(([, list]) => list);
    let i = 0;
    for (const [name, list] of groups)
      if (list.length) html += `<li class="sec" role="presentation">${name}</li>` + list.map((c) => row(c, i++, esc(c.label), c.key)).join('');
  } else {
    hits = all
      .map((c) => {
        const a = fuzzy(q, c.label),
          b = a ? 0 : worded(q, c.hint + ' ' + c.kw);
        return a ? { ...c, score: a.score, at: a.at } : b ? { ...c, score: b, at: [] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    html = hits.length
      ? hits.map((c, i) => row(c, i, lit(c.label, c.at), c.sec.toLowerCase())).join('')
      : `<li class="none" role="presentation"><b>Nothing by that name in the pond.</b>Try a project, a song, or “rain”.</li>`;
  }
  sel = clamp(sel, 0, Math.max(0, hits.length - 1));
  $('#palList').innerHTML = html;
  $('#palN').textContent = hits.length === 1 ? '1 result' : `${hits.length} results`;
  mark();
}
const row = (c, i, label, right) =>
  `<li role="option" id="opt-${i}" data-i="${i}"><span class="ic">${c.dot ? `<i style="--c:${c.dot}"></i>` : ico(c.icon)}</span><span class="tx"><b>${label}</b><small>${esc(c.hint)}</small></span><span class="rt">${right ? (right.length <= 3 && right !== 'pond' ? `<kbd>${esc(right)}</kbd>` : esc(right)) : ''}</span></li>`;
function mark() {
  $('#palList')
    .querySelectorAll('[role=option]')
    .forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === sel)));
  const cur = $('#opt-' + sel);
  $('#palIn').setAttribute('aria-activedescendant', cur ? cur.id : '');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
  if (sel === 0) $('#palList').scrollTop = 0;
}
const palOpen = () => 'open' in $('#palWrap').dataset;
function openPal(prefix) {
  if (!palOpen()) palFocus = document.activeElement;
  $('#palIn').value = prefix || '';
  sel = 0;
  drawPal();
  $('#palWrap').dataset.open = '';
  $('#palIn').focus({ preventScroll: true });
}
function closePal() {
  if (!palOpen()) return;
  delete $('#palWrap').dataset.open;
  $('#palIn').blur();
  if (palFocus && palFocus.focus && palFocus !== document.body) palFocus.focus({ preventScroll: true });
}
function runPal(i) {
  const c = hits[i];
  if (!c) return;
  closePal();
  c.run();
}
$('#cmdBtn').addEventListener('click', () => openPal());
$('#palIn').addEventListener('input', () => {
  sel = 0;
  drawPal();
});
$('#palIn').addEventListener('keydown', (e) => {
  const n = hits.length,
    move = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key] || (e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0);
  if (move) {
    e.preventDefault();
    if (n) {
      sel = Math.abs(move) === 1 ? (sel + move + n) % n : clamp(sel + move, 0, n - 1);
      mark();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runPal(sel);
  }
});
$('#palList').addEventListener('pointermove', (e) => {
  const li = e.target.closest('[data-i]');
  if (li && +li.dataset.i !== sel) {
    sel = +li.dataset.i;
    mark();
  }
});
$('#palList').addEventListener('click', (e) => {
  const li = e.target.closest('[data-i]');
  if (li) runPal(+li.dataset.i);
});
$('#palWrap').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === $('#palWrap')) closePal();
});
function feedMiddle() {
  // into open water: the middle of the pond is the last place to freeze
  const x = W * rnd(0.42, 0.58),
    y = H * rnd(0.44, 0.56);
  if (letterOpen()) putDown();
  audio();
  if (iceAt(x, y) > 0.5) {
    crack(x, y);
    return;
  }
  feed(x, y);
  drop(x, y, 3, -1.6);
  plip('drop');
}
addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
  // 0 to 5 open the chapters in order; with a photograph up, the arrows move through them
  if (!typing && !palOpen() && !e.metaKey && !e.ctrlKey && !e.altKey && /^[0-5]$/.test(e.key)) {
    e.preventDefault();
    openSheet(ORDER[+e.key]);
    return;
  }
  if (viewOpen() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    showPhoto(viewAt + (e.key === 'ArrowLeft' ? -1 : 1));
    return;
  }
  if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    palOpen() ? closePal() : openPal();
    return;
  }
  if (e.key === 'Escape') {
    // esc closes whatever is on top
    if (palOpen()) closePal();
    else if (viewOpen()) closeView();
    else if (sheetOpen()) closeSheet();
    else if (typing) document.activeElement.blur();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || palOpen() || sheetOpen()) return;
  if (e.key === '/') {
    e.preventDefault();
    openPal('/');
  } else if (e.key === 'i' || e.key === 'I') setInk(!inkOn);
  else if (e.key === 'g' || e.key === 'G') {
    if (letterOpen()) putDown();
    setClear(!('clear' in pond.dataset));
  } else if (e.key === 'f' || e.key === 'F') feedMiddle();
  else if (e.key === 'm' || e.key === 'M') {
    audio();
    setMuted(!muted);
  }
});

/* ================= sound: one context, one switch; the water and the fish beside the music ================= */
let AC,
  out,
  sfx,
  muted = false,
  beatN = 0,
  beatTimer = 0;
// While a song plays the water under its row lifts in time, gently: YouTube gives no beat to follow, so this keeps a slow one.
function beat() {
  if (!music().playing || RM) return;
  beatN++;
  const r = ($('#play') || $('#toc')).getBoundingClientRect(),
    pr = pond.getBoundingClientRect();
  drop(r.left - pr.left + r.width / 2 + rnd(-30, 30), r.top - pr.top + r.height / 2 + rnd(-10, 10), 3, beatN % 2 ? 0.5 : -0.4);
}
function audio() {
  if (AC) {
    AC.resume();
    return AC;
  }
  try {
    AC = new window.AudioContext();
  } catch (err) {
    /* no audio on this device: the pond stays silent */ return null;
  }
  out = AC.createGain();
  out.gain.value = muted ? 0 : 1;
  out.connect(AC.destination);
  sfx = AC.createGain();
  sfx.gain.value = 1;
  sfx.connect(out);
  // the water itself: brown noise, low and far off
  const len = AC.sampleRate * 6,
    buf = AC.createBuffer(1, len, AC.sampleRate),
    d = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) {
    v = (v + (Math.random() * 2 - 1) * 0.02) / 1.02;
    d[i] = v * 3.5 * Math.min(1, i / 4000, (len - i) / 4000);
  }
  const src = AC.createBufferSource(),
    lp = AC.createBiquadFilter(),
    g = AC.createGain();
  src.buffer = buf;
  src.loop = true;
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  g.gain.value = 0;
  src.connect(lp);
  lp.connect(g);
  g.connect(sfx);
  src.start();
  g.gain.setTargetAtTime(0.05, AC.currentTime, 2.5);
  return AC;
}
// a drop landing, a mouth closing on a pellet, a beat of wings, ice giving under a tap
let noise = null;
// a short breath of noise through a band: the splash itself
function hiss(t, dur, freq, q, peak) {
  if (!noise) {
    noise = AC.createBuffer(1, Math.round(AC.sampleRate * 0.4), AC.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = AC.createBufferSource(),
    f = AC.createBiquadFilter(),
    g = AC.createGain();
  n.buffer = noise;
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  g.connect(sfx);
  n.start(t, Math.random() * 0.2, dur + 0.02);
}
// the air a drop takes under with it rings as it closes, and its pitch climbs: that climb is what sounds like water
function bubble(t, f0, peak, dur) {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
}
// The sound switch is remembered in this browser.
const saveMuted = (on) => save('pond-sound', on ? 'off' : null);
function plip(kind, vol) {
  if (!AC || muted) return;
  const t = AC.currentTime;
  if (kind === 'ink') {
    // a drop of ink: a soft low touch and a long breath of the brush
    const v = 0.07 * (vol || 1);
    hiss(t, 0.5, 900, 0.6, v * 0.35);
    bubble(t, rnd(180, 220), v, 0.4);
    return;
  }
  if (kind === 'drop') {
    const v = 0.075 * (vol || 1),
      f0 = rnd(540, 760);
    hiss(t, 0.03, 3200, 0.8, v * 0.5);
    bubble(t + 0.012, f0, v, 0.085);
    bubble(t + rnd(0.06, 0.09), f0 * rnd(1.25, 1.45), v * 0.45, 0.06);
    return;
  }
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = 'sine';
  if (kind === 'crack') {
    o.type = 'square';
    o.frequency.setValueAtTime(rnd(1500, 2100), t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.05);
  } else if (kind === 'flap') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(rnd(150, 190), t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
  } else if (kind === 'eat') {
    o.frequency.setValueAtTime(250, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.07);
  } else {
    o.frequency.setValueAtTime(rnd(820, 1080), t);
    o.frequency.exponentialRampToValueAtTime(rnd(250, 330), t + 0.11);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.1 * (vol || 1), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g);
  g.connect(sfx);
  o.start(t);
  o.stop(t + 0.25);
}
function setMuted(on) {
  muted = on;
  if (out) out.gain.setTargetAtTime(on ? 0 : 1, AC.currentTime, 0.05);
  setMusicMuted(on);
  saveMuted(on);
  $('#snd').setAttribute('aria-pressed', String(!on));
  $('#snd').setAttribute('aria-label', on ? 'Turn the sound on' : 'Turn the sound off');
  $('#sndWave').setAttribute('d', on ? 'M10.6 6l3.4 4M14 6l-3.4 4' : 'M11 5.6a3.4 3.4 0 0 1 0 4.8');
}
onMusic((m) => {
  fillMusic();
  clearInterval(beatTimer);
  if (m.playing) beatTimer = setInterval(beat, 1400);
});
$('#play').addEventListener('click', () => {
  audio();
  void toggleSong();
});
$('#snd').addEventListener('click', () => {
  audio();
  setMuted(!muted);
});

/* ================= the opening ================= */
function place() {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (err) {
    /* older browsers: no place, the clock still reads */
  }
  return /\//.test(tz) && !/^Etc/.test(tz) ? tz.split('/').pop().replace(/_/g, ' ') : '';
}
// A word for whoever came: some for the hour, some for any hour, one picked each time.
function salute() {
  const h = new Date().getHours();
  const hour =
    h < 5
      ? ['Still up?', 'Late one. Come in.']
      : h < 12
        ? ['Good morning.', 'Morning, early bird.']
        : h < 17
          ? ['Good afternoon.', 'Afternoon. Sit a while.']
          : h < 21
            ? ['Good evening.', 'Evening. Stay a while.']
            : ['Still up?', 'Late one. Come in.'];
  const pool = [
    ...hour,
    'Welcome to the pond.',
    "Come in, the water's fine.",
    "Glad you're here.",
    'Hello, stranger.',
    'Oh, hello.',
    'You found the pond.',
    'Take your time.',
    'Mind the lily pads.',
    'Nice of you to drop by.'
  ];
  return [pool[(Math.random() * pool.length) | 0], ''];
}
let run = 0;
const later = (ms, fn, id) =>
  setTimeout(() => {
    if (id === run) fn();
  }, ms);
// The opening: the pond first, and the gold koi comes in to meet whoever arrived.
function intro() {
  const id = ++run;
  arrived = false;
  $('#greet').innerHTML = '';
  boats.length = 0;
  setClear(false);
  closeSheet();
  document.querySelectorAll('.rise').forEach((c) => delete c.dataset.in);
  delete host.tag.dataset.on;
  delete you.tag.dataset.on;
  host.x = -170;
  host.y = H * 0.66;
  host.a = 0;
  host.mode = 'script';
  host.tx = W * 0.5;
  host.ty = H * 0.62;
  host.alpha = 0;
  for (const s of host.spine) {
    s.x = host.x;
    s.y = host.y;
  }
  later(
    7000,
    () => {
      if (!arrived) {
        host.mode = 'wander';
        host.wander();
      }
    },
    id
  );
  delete $('#greet').dataset.gone;
  arrived = true;
  arrival();
}
// The title page rises line by line, a word comes up across the water, the boats drift in.
function arrival() {
  const id = run,
    [hello, sub] = salute(),
    el = $('#greet'),
    cards = [...document.querySelectorAll('.home .rise')];
  $('#hero').textContent = hello;
  el.innerHTML = sub;
  const words = [...el.querySelectorAll('w')];
  if (RM) {
    words.forEach((w) => (w.dataset.in = ''));
    cards.forEach((c) => (c.dataset.in = ''));
    NOTES.slice(0, 3).forEach((n) => launchBoat(n.body, n.name));
    host.x = W * 0.5;
    host.y = H * 0.62;
    host.mode = 'wander';
    host.wander();
    return;
  }
  words.forEach((w, k) => later(350 + k * 70 + (k > 1 ? 500 : 0), () => (w.dataset.in = ''), id));
  cards.forEach((c, i) => later(650 + i * 120, () => (c.dataset.in = ''), id));
  host.tag.dataset.on = '';
  you.tag.dataset.on = '';
  later(
    700,
    () => {
      host.mode = 'visit';
    },
    id
  );
  NOTES.slice(0, 3).forEach((n, i) => later(2400 + i * 600, () => launchBoat(n.body, n.name), id));
  later(
    6500,
    () => {
      delete you.tag.dataset.on;
    },
    id
  );
  later(
    9500,
    () => {
      host.mode = 'wander';
      host.wander();
      delete host.tag.dataset.on;
    },
    id
  );
}

/* ================= pointer ================= */
// Glass, paper and controls are above the water: a press or a stroke there never reaches it.
const DRY = '.glass, .hud > *, .veil, .pal-wrap';
const spot = (e) => {
  const r = pond.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};
pond.addEventListener('pointermove', (e) => {
  const [x, y] = spot(e),
    wet = !e.target.closest(DRY);
  if (ptr.moved && wet && !inkOn) {
    const d = Math.hypot(x - ptr.lx, y - ptr.ly),
      n = Math.min(6, Math.ceil(d / 14));
    for (let i = 1; i <= n; i++) drop(ptr.lx + ((x - ptr.lx) * i) / n, ptr.ly + ((y - ptr.ly) * i) / n, 1.5, -clamp(d * 0.012, 0.03, 0.3) / n);
  }
  ptr.x = ptr.lx = x;
  ptr.y = ptr.ly = y;
  ptr.moved = true;
  ptr.at = T;
  if (e.pointerType === 'mouse') showBoat(wet ? boatAt(x, y) : null);
});
pond.addEventListener('pointerdown', (e) => {
  if (e.target.closest(DRY)) return;
  const [x, y] = spot(e),
    b = boatAt(x, y);
  ptr.x = ptr.lx = x;
  ptr.y = ptr.ly = y;
  ptr.moved = true;
  ptr.at = T;
  if (b && e.pointerType !== 'mouse') {
    showBoat(b);
    return;
  }
  audio();
  if (iceAt(x, y) > 0.5) {
    crack(x, y);
    return;
  }
  if (inkOn) {
    // on paper a press leaves a blot that spreads, and the fish still come to it
    blots.unshift({ x, y, at: T });
    blots.length = Math.min(blots.length, 10);
    drop(x, y, 2.4, -0.9);
    feed(x, y);
    plip('ink', 0.7);
    for (const k of kois) if (k !== you && Math.hypot(k.x - x, k.y - y) < 130) k.burst = 0.5;
    return;
  }
  drop(x, y, 3.2, -2);
  feed(x, y);
  plip('drop');
  for (const k of kois) if (k !== you && Math.hypot(k.x - x, k.y - y) < 130) k.burst = 0.7;
});

/* ================= the clock and who is here ================= */
function tick() {
  const d = new Date(),
    h = d.getHours(),
    mm = String(d.getMinutes()).padStart(2, '0'),
    city = place();
  const part = h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 21 ? 'in the evening' : 'at night';
  $('#clockBig').textContent = `${h % 12 || 12}:${mm}`;
  $('#clockPart').textContent = `${h < 12 ? 'am' : 'pm'} · ${city || 'your time'}`;
  let his = '';
  try {
    his = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d);
  } catch (err) {
    /* no time zones here: only the visitor's clock shows */
  }
  $('#hisTime').textContent = his ? `${his.replace(/\s?([AP])M$/, (_, x) => ` ${x.toLowerCase()}m`)} for me, in San Jose` : 'San Jose, California';
  if (phaseChoice === 'auto') setPhase('auto');
  const lt = $('#letterTime');
  if (lt) lt.textContent = `${h % 12 || 12}:${mm} ${part}${city ? ' in ' + city : ' where you are'}`;
}
// Who is here: this visitor and everyone presence knows of, on the pond and on the old desktop alike.
let online = 0;
function census() {
  const here = [you, ...others.values()];
  online = here.length;
  $('#dots').innerHTML = here
    .slice(0, 5)
    .map((k) => `<i style="background:${esc(k.dot)}"></i>`)
    .join('');
  $('#talkN').textContent = here.length;
}
/* ================= the loop ================= */
function resize() {
  const r = pond.getBoundingClientRect();
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  big = W > 860;
  initSim();
  sizeGL();
  makeIce();
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  stepInk(raw);
  // in ink, time runs slow: everything that moves is stepped by dt
  const dt = raw * timeScale;
  T += dt;
  lifeDt = dt;
  panes();
  stepYear(dt);
  holes();
  focus += (focusGoal - focus) * Math.min(1, dt * 6);
  $('#knob').style.top = focus * 100 + '%';
  $('#gauge').toggleAttribute('data-live', T < focusLive);
  // rain over open water; over ice it comes as snow instead
  if (raining && AM.ice < 0.3) for (let i = 0; i < (big ? 3 : 1); i++) if (Math.random() < 0.55) drop(rnd(0, W), rnd(0, H), 1.1, -rnd(0.25, 0.7));
  for (const k of kois) k.update(dt);
  simAcc += 2 * timeScale;
  while (simAcc >= 1) {
    stepSim();
    simAcc -= 1;
  }
  stepAfloat(dt);
  stepSpider(dt);
  stepAir(dt);
  easePhase(dt);
  if (!letterOpen() && !sheetOpen() && spider.alpha > 0.5 && T > bugAt) {
    dropBug();
    bugAt = T + rnd(40, 75);
  }
  for (const k of kois) {
    const near = ptr.moved && k !== you && Math.hypot(k.x - ptr.x, k.y - ptr.y) < 110,
      hid = underGlass(k.x + 30, k.y + 24) || k.alpha < 0.5;
    k.tag.style.transform = `translate3d(${k.x + 16}px,${k.y + 18}px,0)`;
    k.tag.style.opacity = hid ? 0 : (k === you || k === host) && 'on' in k.tag.dataset ? '' : near ? 1 : '';
  }
  // the two visitors carry their projects' names
  for (const [tag, x, y, on] of [
    [doveTag, dove.x + 26, dove.y - 36, dove.state === 'sit'],
    [
      spiderTag,
      spider.x + 22,
      spider.y - 30,
      spider.alpha > 0.6 && ptr.moved && Math.hypot(ptr.x - spider.x, ptr.y - spider.y) < 90 && !underGlass(spider.x, spider.y)
    ]
  ]) {
    tag.style.transform = `translate3d(${x}px,${y}px,0)`;
    tag.toggleAttribute('data-on', on);
  }
  drawAir();
  if (!glOK) return;
  drawKoi();
  drawTop();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
  gl.viewport(0, 0, glc.width, glc.height);
  gl.useProgram(prog);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texH);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, GW, GH, 0, gl.RED, gl.FLOAT, hA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texFish);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fishCv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, texTop);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, topCv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, texPads);
  gl.activeTexture(gl.TEXTURE6);
  gl.bindTexture(gl.TEXTURE_2D, texIce);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texBed);
  gl.uniform1i(U.uBed, 0);
  gl.uniform1i(U.uH, 1);
  gl.uniform1i(U.uFish, 2);
  gl.uniform1i(U.uPads, 3);
  gl.uniform1i(U.uTop, 5);
  gl.uniform1i(U.uIceN, 6);
  gl.uniform2f(U.uRes, glc.width, glc.height);
  gl.uniform2f(U.uGrid, GW, GH);
  gl.uniform2f(U.uMoonPos, big ? 0.6 : 0.74, big ? 0.1 : 0.12);
  gl.uniform4f(U.uInk, inkR, inkO[0], inkO[1], inkR > 0 ? (inkOn && inkR >= inkMax ? 1 : 0.5) : 0);
  for (let i = 0; i < 10; i++) {
    const b = blots[i];
    blotU.set(b ? [b.x, b.y, T - b.at] : [0, 0, -1], i * 3);
  }
  gl.uniform3fv(U.uBlot, blotU);
  calmNow += (('clear' in pond.dataset ? 0 : 1) - calmNow) * Math.min(1, lifeDt * 3);
  gl.uniform2f(U.uCalm, big ? 0 : 1, calmNow);
  gl.uniform1f(U.uTime, RM ? 3 : T);
  gl.uniform1f(U.uSwell, RM ? 0 : 1);
  gl.uniform1f(U.uFocus, focus);
  gl.uniform1f(U.uIce, AM.ice);
  gl.uniform1f(U.uSnow, AM.snow);
  gl.uniform1f(U.uAmb, cur.amb);
  gl.uniform1f(U.uCaI, cur.cai * AM.light);
  gl.uniform1f(U.uMoon, cur.moon);
  gl.uniform4fv(U.uBox, boxA);
  gl.uniform4fv(U.uBoxB, boxB);
  gl.uniform1i(U.uBoxN, boxN);
  gl.uniform2f(U.uCss, W, H);
  for (let i = 0; i < 6; i++) {
    const q = cracks[i],
      open = q && q.broke >= 0 && T >= q.broke && T - q.broke < 82,
      on = q && (T - q.at < 90 || open);
    crackU.set(on ? [q.x, q.y, T - q.at, q.r] : [0, 0, -1, 1], i * 4);
    brokeU[i] = open ? T - q.broke : -1;
  }
  gl.uniform4fv(U.uCrack, crackU);
  gl.uniform1fv(U.uBroke, brokeU);
  gl.uniform3fv(U.uTint, cur.tint);
  gl.uniform3fv(U.uCaC, cur.cac);
  gl.uniform3fv(U.uSky, cur.sky);
  gl.uniform3fv(U.uSeason, AM.tint);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(glassProg);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, texScene);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(UG.uScene, 4);
  gl.uniform2f(UG.uCss, W, H);
  gl.uniform1f(UG.uLod, 2.4 + Math.log2(glDpr));
  gl.uniform1f(UG.uFrost, Math.max(AM.ice, AM.snow * 0.8));
  // the glass turns to paper with the pond
  const pk = inkMax ? clamp(inkR / inkMax, 0, 1) : 0,
    gs = [0.03 + cur.tint[0] * 0.03, 0.09 + cur.tint[1] * 0.04, 0.1 + cur.tint[2] * 0.045];
  gl.uniform3f(UG.uGlass, lerpN(gs[0], 0.95, pk), lerpN(gs[1], 0.92, pk), lerpN(gs[2], 0.85, pk));
  gl.uniform4fv(UG.uPane, paneA);
  gl.uniform4fv(UG.uPaneB, paneB);
  gl.uniform1i(UG.uPaneN, paneN);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
const crackU = new Float32Array(24),
  brokeU = new Float32Array(6),
  doveTag = Object.assign(document.createElement('span'), { className: 'tag', textContent: 'Devot' }),
  spiderTag = Object.assign(document.createElement('span'), { className: 'tag', textContent: 'ocra' });
$('#tags').append(doveTag, spiderTag);
// Settled: the opening has played and the browser is idle. What isn't on the first screen loads then.
const settled = new Promise((resolve) => setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => resolve()), 2600));
settled
  .then(() => import('./life.js'))
  .then(
    (L) => {
      try {
        life = L.makeLife();
      } catch (err) {
        report(err, 'pond models');
      }
    },
    (err) => report(err, 'pond models')
  );
settled.then(loadSongs);
people.startPeople(
  {
    onAccount: (a) => {
      me = a;
      if (sheetOpen() && /^(account|chat|notes)$/.test(location.hash.slice(1))) openSheet(location.hash.slice(1));
    },
    onVisitors: seeVisitors,
    onNotes: (n) => {
      const first = !NOTES.length;
      NOTES = n;
      fillNotes();
      if (first && arrived) n.slice(0, 3).forEach((x, i) => setTimeout(() => launchBoat(x.body, x.name), i * 600));
    },
    onAvailable: (on) => {
      accountsOpen = on;
    }
  },
  settled
);
let bugAt = 30;

function start() {
  try {
    initGL();
  } catch (err) {
    glOK = false;
    console.warn('The pond needs WebGL 2; showing it still.', err);
  }
  if (!glOK) pond.classList.add('nogl');
  $('#cmdKey').textContent = MAC ? '⌘K' : 'Ctrl K';
  if (load('pond-sound') === 'off') setMuted(true);
  paneEls = [...document.querySelectorAll('.glass')];
  resize();
  makeKoi();
  makePetals();
  makeShade();
  fillPanes();
  setPhase('auto');
  showTerm();
  tick();
  census();
  setInterval(tick, 20000);
  if (glOK) glc.dataset.on = '';
  intro();
  requestAnimationFrame(frame);
  {
    const [ch, at] = location.hash.slice(1).split('/');
    if (CHAPTERS[ch]) setTimeout(() => openSheet(ch, at), 1400);
  }
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      resize();
      makePetals();
    }, 150);
  });
}
start();
