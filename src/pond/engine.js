// The pond: a full-bleed pond seen from above, its title page and its
// chapters (src/pages/index.astro has the markup and the build-time data).
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
import { effectsOf, loadWeather, minutesAt, phaseAt, seasonOf } from './weather';
import { SHEETS as SPRITES, frameAt, doveFrame, lit as litLook, spiderFrame, spritePics } from './sprites.js';
import { PANEL, WELCOME_BACK, festivalDate, festivalOn, moonAge, moonLit, panel, returning } from './preview.js';
// the looks' type, as a stylesheet of its own: linked only once a look or 日 is chosen (loadType)
import LOOKS_CSS from './looks.css?url';
import {
  SEAL_WORDS,
  albumHTML,
  allFull,
  clearSeals,
  count as sealCount,
  dayOf,
  entryShows,
  full,
  markSealed,
  mayHint,
  readAlbum,
  sealMark,
  stamp,
  volumes,
  writeAlbum
} from './seals';
import { FPS, IDLE_AFTER, due, learnBeat, simSteps } from './clock.js';
import { PERF, add, count, frameDone, span } from './perf.js';
import { strokeLifted, strokeMoving, tapsLook } from './gestures';
import { crowdsPainting, underPainting } from './hang.js';
import { paintingOf, seasonAmounts } from './seasons.js';
import {
  KOI_SHEETS,
  MONET,
  MURAL,
  MURAL_LARGE,
  NEW_COMMANDS,
  NEW_GLASS,
  NEW_GLSL,
  NEW_LAY,
  NEW_LOOKS,
  NEW_SHADE,
  NEW_SID,
  NEW_WITHOUT,
  LOOK_ART,
  QINGHUA,
  RELIEF,
  STARS,
  UKIYO,
  muralLayout,
  reliefLayout
} from './newlooks.js';
import { SocialError } from '../os/social/errors';
import { coverOf, loadSongs, music, onMusic, play as playSongAt, setMusicMuted, toggle as toggleSong } from './music';
import * as people from './people';

const $ = (s) => document.querySelector(s);
/** What the page gathered at build time: the timeline, the photos, the About chapter. */
const D = JSON.parse($('#pond-data').textContent);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// With ?preview: the real moon, the wind, the festivals, fireflies, stars, a welcome back (preview.js)
const pv = { age: moonAge(), fest: festivalOn(), flies: [], fliesOn: false, windX: 13, windY: 6, boatAt: -1e9, wakeAt: 0, lanterns: [] };
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
    if (this.mode === 'greet') {
      // swims over to the visitor's koi and round it once
      const a = T * 0.9;
      this.tx = you.x + Math.cos(a) * 80;
      this.ty = you.y + Math.sin(a) * 80;
    }
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
  // In the star chart a koi is a constellation: a few stars along its back and at its fins, joined by thin
  // lines that bend as it swims, the brightest lettered as an atlas letters them.
  drawStars(c) {
    const s = this.spine,
      S = this.size,
      at = [0, 2, 4, 7, 9, N - 1],
      gold = this === host,
      col = gold ? '255,214,140' : '214,228,255';
    const nrm = (i) => {
      const a = s[Math.max(0, i - 1)],
        b = s[Math.min(N - 1, i + 1)],
        l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      return [-(a.y - b.y) / l, (a.x - b.x) / l];
    };
    const [nx, ny] = nrm(3),
      [tx, ty] = nrm(N - 2),
      fins = [
        [s[3].x + nx * S * 0.2, s[3].y + ny * S * 0.2],
        [s[3].x - nx * S * 0.2, s[3].y - ny * S * 0.2]
      ],
      tail = [
        [s[N - 1].x + tx * S * 0.11 + (s[N - 1].x - s[N - 2].x) * 1.6, s[N - 1].y + ty * S * 0.11 + (s[N - 1].y - s[N - 2].y) * 1.6],
        [s[N - 1].x - tx * S * 0.11 + (s[N - 1].x - s[N - 2].x) * 1.6, s[N - 1].y - ty * S * 0.11 + (s[N - 1].y - s[N - 2].y) * 1.6]
      ];
    // the atlas's figure behind the stars: a koi in outline, faint, bent along the same spine
    if (starFigure) this.drawSprite(c, starFigure, 0, FIGURE, gold ? 0.42 : 0.3, false);
    c.save();
    c.globalAlpha = this.alpha * (1 - 0.3 * this.depth);
    c.strokeStyle = `rgba(${col},0.5)`;
    c.lineWidth = 0.9;
    c.beginPath();
    at.forEach((i, k) => (k ? c.lineTo(s[i].x, s[i].y) : c.moveTo(s[i].x, s[i].y)));
    for (const f of fins) {
      c.moveTo(s[2].x, s[2].y);
      c.lineTo(f[0], f[1]);
      c.lineTo(s[4].x, s[4].y);
    }
    c.moveTo(tail[0][0], tail[0][1]);
    c.lineTo(s[N - 1].x, s[N - 1].y);
    c.lineTo(tail[1][0], tail[1][1]);
    c.stroke();
    const dot = (x, y, r, fill) => {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(x, y, r, 0, 6.2832);
      c.fill();
    };
    at.forEach((i, k) => {
      const r = (k === 0 ? 2.6 : k % 2 ? 1.5 : 2) * (S / 100) * 0.9 + 0.6;
      dot(s[i].x, s[i].y, r * 2.6, `rgba(${col},0.16)`);
      dot(s[i].x, s[i].y, r, k === 0 && this === you ? 'rgb(255,120,110)' : `rgb(${col})`);
    });
    for (const q of [...fins, ...tail]) dot(q[0], q[1], 1.2, `rgba(${col},0.9)`);
    c.font = "italic 10px 'Cormorant Garamond', Georgia, serif";
    c.fillStyle = `rgba(${col},0.75)`;
    ['α', 'β', 'γ'].forEach((g, k) => c.fillText(g, s[at[k]].x + 6, s[at[k]].y - 5));
    c.restore();
  }
  // A painted koi: a straight picture seen from above, cut into slices along its length, each slice laid
  // along the koi's own spine as it is now, so the painting swims, turns and curls as the drawn koi does. The
  // tail runs on past the spine's end and sways with the stroke. sy is how far down the picture the koi's row
  // starts; `strength` thins it, and `sealed` is whether it may wear the album's seal.
  drawSprite(c, pic, sy, sh, strength = 1, sealed = true) {
    const s = this.spine,
      acc = [0];
    for (let i = 1; i < N; i++) acc.push(acc[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
    const L = acc[N - 1],
      tail = L * 0.27,
      total = L + tail,
      n = 28,
      span = sh.x1 - 62,
      k = total / span,
      h = sh.rowH * k,
      live = (0.5 + clamp(this.sp / this.cruise, 0, 2.4) * 0.6) * (0.74 + 0.26 * Math.sin(T * 0.7 + this.seed)),
      sway = Math.sin(this.ph - 3.6) * 0.42 * live,
      ex = s[N - 1].x - s[N - 2].x,
      ey = s[N - 1].y - s[N - 2].y,
      ea = Math.atan2(ey, ex);
    let j = 0;
    const at = (d) => {
      if (d >= L) {
        // the tail: on from the last joint, bending with the stroke
        const u = (d - L) / tail,
          a = ea + sway * u;
        return [s[N - 1].x + Math.cos(a) * (d - L), s[N - 1].y + Math.sin(a) * (d - L)];
      }
      while (j < N - 2 && acc[j + 1] < d) j++;
      const t = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
      return [s[j].x + (s[j + 1].x - s[j].x) * t, s[j].y + (s[j + 1].y - s[j].y) * t];
    };
    // drawn from the copy of the picture nearest the size it is drawn at, so fine lines don't shimmer
    const m = k < 0.2 ? 0.25 : k < 0.4 ? 0.5 : 1,
      src = shrunk(pic, m);
    c.save();
    c.globalAlpha = this.alpha * (1 - 0.34 * this.depth) * strength;
    let [x0, y0] = at(0);
    for (let i = 0; i < n; i++) {
      const [x1, y1] = at((total * (i + 1)) / n),
        len = Math.hypot(x1 - x0, y1 - y0);
      c.save();
      c.translate(x0, y0);
      c.rotate(Math.atan2(y1 - y0, x1 - x0));
      c.drawImage(src, (62 + (span * i) / n) * m, sy * m, (span / n + 1.5) * m, sh.rowH * m, -0.4, -h / 2, len + 1.2, h);
      c.restore();
      x0 = x1;
      y0 = y1;
    }
    if (this.seal && sealed) {
      const [qx, qy] = at(L * 0.62),
        q = this.size * 0.032;
      // the seal, as a small dab of vermilion in the painting's own hand
      c.fillStyle = 'rgba(190,52,40,0.88)';
      c.beginPath();
      c.ellipse(qx, qy, q * 1.15, q * 0.9, 0.5, 0, 6.2832);
      c.fill();
    }
    c.restore();
  }
  draw(c) {
    if (this.alpha <= 0.01) return;
    if (look === 'stars' && inkR > inkMax * 0.45) return this.drawStars(c);
    // a look with painted koi draws them from its sheet, once it has come
    const sh = koiSheets[look];
    if (sh && sh.pic && inkR > inkMax * 0.45) return this.drawSprite(c, ...koiPicture(this, sh), sh);
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
    // in ink a koi that crosses the season's painting passes under it: the painting is on the paper, the koi in
    // the water, so its ink thins there
    this.veil = (this.veil ?? 1) + ((inkOn && underPainting(this.x, this.y, W, H, inkSeason()) ? 0.3 : 1) - (this.veil ?? 1)) * 0.06;
    c.save();
    c.globalAlpha = this.alpha * (1 - 0.34 * this.depth) * this.veil;
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
    // a small seal on the back of a koi that has earned one (the seal album)
    if (this.seal) {
      const q = S * 0.046;
      c.save();
      c.translate(P[7][0], P[7][1]);
      c.rotate(ang(7));
      c.fillStyle = '#b8382a';
      c.fillRect(-q, -q, q * 2, q * 2);
      c.restore();
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
  koiSeals();
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
// Each look's own pictures of the pads, of what drifts and flies, and of the two visitors (LOOK_ART in
// newlooks.js). A picture is asked for the first time its look needs it; until it has come, and if it
// never does, what the pond draws for every look stands.
const artPics = new Map();
// (nothing of the pond's own pictures is asked for before the pond has settled)
let settledNow = false;
function artOf(kind, name = look) {
  const d = LOOK_ART[name]?.[kind];
  if (!d || !settledNow) return null;
  if (!artPics.has(d.src)) {
    artPics.set(d.src, null);
    const im = new Image();
    im.onload = () => {
      artPics.set(d.src, im);
      topAt = -1e9;
      padsNow();
      invalidate();
    };
    im.onerror = () => report(new Error(`no picture at ${d.src}`), 'pond pictures');
    im.src = d.src;
  }
  const pic = artPics.get(d.src);
  return pic ? { ...d, pic } : null;
}
// one cell of a sheet of 256-pixel cells, drawn d across about the origin
const cellAt = (c, pic, [i, j], d) => c.drawImage(pic, i * 256, j * 256, 256, 256, -d / 2, -d / 2, d, d);
// The water's own lily pads and flowers as pictures (public/pond/water/lilies-768.webp, cells of 192):
// fetched once the pond has settled and there are pads to draw, and the drawn pads stand until then.
let waterLily = null,
  waterLilyAsked = false,
  autumnPic = null;
// (asked for the first time there are pads to draw on the water, so a winter visit never fetches it)
function askWaterLily() {
  if (waterLilyAsked) return;
  waterLilyAsked = true;
  const im = new Image();
  im.onload = () => {
    waterLily = im;
    padKey = '';
    padsNow();
    invalidate();
  };
  im.onerror = () => report(new Error('no picture at /pond/water/lilies-768.webp'), 'pond pictures');
  im.src = '/pond/water/lilies-768.webp';
}
function monetAutumn() {
  if (autumnPic === null) {
    autumnPic = false;
    const im = new Image();
    im.onload = () => {
      autumnPic = im;
      padKey = '';
      invalidate();
    };
    im.onerror = () => report(new Error('no picture of Monet’s autumn pads'), 'pond pictures');
    im.src = MONET.autumn;
  }
  return autumnPic;
}
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
    // in ink no pad lies under the season's painting: the painting has that part of the paper
    if (inkOn && crowdsPainting(x * W, y * H, W, H, inkSeason())) continue;
    // a look with its own picture of them: by size, at the size the pond gives the pad, its flower or bud
    // on it in season
    const own = look !== 'water' && look !== 'monet' ? artOf('pads') : null;
    if (own) {
      const n = Math.floor(r0 * 7 + rot * 3),
        set = r > 58 ? own.large : r > 34 ? own.medium : own.small,
        cell = set[n % set.length],
        d = (r * 2) / (own.across * (r > 58 ? 1 : r > 34 ? 0.8 : 0.62));
      c.save();
      c.translate(x * W, y * H);
      c.rotate(rot);
      c.globalAlpha = Math.min(1, grow * 1.6) * (own.light ? 1 : 1 - 0.3 * AM.brown);
      cellAt(c, own.pic, cell, d);
      c.restore();
    }
    // on the water (a preview build) the pads are pictures of real ones, from their sheet: whole or
    // notched, by size, the withered ones laid over the green as autumn comes
    if (look === 'water' && settledNow) askWaterLily();
    const real = waterLily && look === 'water';
    if (real) {
      const n = Math.floor(r0 * 7 + rot * 3),
        [ci, d] = r > 58 ? [n % 2, r * 2.42] : r > 34 ? [2, r * 3.08] : [3, r * 4.38];
      c.save();
      c.translate(x * W, y * H);
      c.rotate(rot);
      c.globalAlpha = Math.min(1, grow * 1.6);
      c.drawImage(waterLily, ci * 192, 0, 192, 192, -d / 2, -d / 2, d, d);
      if (AM.brown > 0.02) {
        c.globalAlpha = Math.min(1, grow * 1.6) * Math.min(1, AM.brown * 1.25);
        c.drawImage(waterLily, ci * 192, 192, 192, 192, -d / 2, -d / 2, d, d);
      }
      c.restore();
    }
    // in Monet's pond the pads are painted ones, from their sheet (large, medium and small, by size)
    const lily = (lilyPic && look === 'monet') || real || !!own;
    if (lilyPic && look === 'monet') {
      const n = Math.floor(r0 * 7 + rot * 3),
        [ci, cj] =
          r > 58
            ? [n % 3, 0]
            : r > 34
              ? [
                  [3, 0],
                  [0, 1]
                ][n % 2]
              : [
                  [1, 1],
                  [2, 1]
                ][n % 2],
        d = r * 2.75;
      c.save();
      c.globalAlpha = Math.min(1, grow * 1.6) * (1 - 0.35 * AM.brown);
      c.translate(x * W, y * H);
      c.rotate(rot);
      c.drawImage(lilyPic, ci * 256, cj * 256, 256, 256, -d / 2, -d / 2, d, d);
      // (as autumn comes, the same pad gone ochre and rust, from the autumn row, laid over it)
      const fall = AM.brown > 0.02 && monetAutumn();
      if (fall) {
        c.globalAlpha = Math.min(1, grow * 1.6) * Math.min(1, AM.brown * 1.25);
        c.drawImage(
          fall,
          (n % 4) * 256,
          0,
          256,
          256,
          -(d * (r > 58 ? 1 : r > 34 ? 0.83 : 0.6)) / 2,
          -(d * (r > 58 ? 1 : r > 34 ? 0.83 : 0.6)) / 2,
          d * (r > 58 ? 1 : r > 34 ? 0.83 : 0.6),
          d * (r > 58 ? 1 : r > 34 ? 0.83 : 0.6)
        );
      }
      c.restore();
    }
    c.save();
    c.globalAlpha = lily ? 0 : Math.min(1, grow * 1.6);
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
    // and their flowers: a bud in spring, half open as summer comes, open at its height, in white or pink
    if (own) {
      const fl =
        own.flowers.length && AM.bloom > 0.55 ? own.flowers[Math.floor(r0 * 5) % own.flowers.length] : AM.bloom > 0.05 ? own.bud || own.flowers[0] : null;
      if (kind === 1 && fl) {
        const d = (big ? 92 : 72) * (0.6 + 0.4 * AM.bloom);
        c.save();
        c.translate(clamp(x * W, d / 2, W - d / 2) + Math.cos(rot) * r * 0.1, y * H - r * 0.12);
        cellAt(c, own.pic, fl, d);
        c.restore();
      }
    } else if (real && kind === 1 && AM.bloom > 0.05) {
      // (in bud as summer comes, open at its height, in white or pink)
      const open = AM.bloom > 0.55,
        ci = open ? Math.floor(r0 * 5) % 2 : 2,
        d = (big ? 92 : 72) * (0.6 + 0.4 * AM.bloom) * (open ? 1 : 0.8);
      c.drawImage(waterLily, ci * 192, 384, 192, 192, clamp(x * W, d / 2, W - d / 2) - d / 2 + Math.cos(rot) * r * 0.1, y * H - r * 0.12 - d / 2, d, d);
    } else if (real) {
      // (no flower out of its season)
    } else if (lily && kind === 1 && (AM.bloom > 0.05 || AM.petals > 0.3)) {
      const pink = Math.floor(r0 * 5) % 2,
        [ci, cj] = AM.bloom > 0.55 ? (pink ? [1, 2] : [3, 1]) : AM.bloom > 0.05 ? (pink ? [2, 2] : [0, 2]) : [3, 2],
        d = (big ? 96 : 76) * (0.6 + 0.4 * Math.max(AM.bloom, 0.3));
      c.drawImage(lilyPic, ci * 256, cj * 256, 256, 256, clamp(x * W, d / 2, W - d / 2) - d / 2 + Math.cos(rot) * r * 0.1, y * H - r * 0.12 - d / 2, d, d);
    } else if (kind === 1 && AM.bloom > 0.05) {
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
  const key = `${Math.round(AM.lush * 30)}|${Math.round(AM.brown * 20)}|${Math.round(AM.bloom * 20)}|${lilyPic && look === 'monet' ? Math.round(AM.petals * 4) + 1 : 0}|${waterLily && look === 'water' ? 1 : 0}|${look}${artOf('pads') ? 1 : 0}|${inkOn ? inkSeason() + 1 : 0}`;
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
function yearToday(now = new Date()) {
  const doy = (m, d) => Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5),
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
let yearAuto = true,
  yearGoal = yearToday(),
  year = yearGoal;
// how much of each thing the pond holds at a point in the year
const AM = { petals: 0, lush: 0, bloom: 0, flies: 0, leaves: 0, brown: 0, ice: 0, snow: 0, tint: [1, 1, 1], light: 1 };
// south of the equator the season the pond shows is half a year on (the term's name stays the calendar's)
let south = false;
function amounts(term) {
  // (what belongs to which season is in seasons.js, with its tests)
  Object.assign(AM, seasonAmounts(seasonOf(term, south ? -1 : 1)));
}
amounts(year);
function setYear(y) {
  yearAuto = y === undefined;
  yearGoal = yearAuto ? yearToday() : y;
  showTerm();
}
// the terms as Japan writes them, where the forms differ
const TERM_JA = { 惊蛰: '啓蟄', 谷雨: '穀雨', 小满: '小満', 芒种: '芒種', 处暑: '処暑' };
function showTerm() {
  const i = Math.floor(yearGoal) % 24;
  // one character a cell, each centred by its ink (alignInk), so the column stands straight
  $('#kuanTxt').innerHTML = [...`${TERMS[i][0]}画池塘`].map((ch) => `<span>${ch}</span>`).join('');
  placeKuan();
  paintInk();
  $('#termV').innerHTML = [...((lang === 'ja' && TERM_JA[TERMS[i][0]]) || TERMS[i][0])].map((ch) => `<span>${ch}</span>`).join('');
  $('#termTxt').textContent = zhOn ? '' : TERMS[i][1];
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
const FS_SRC = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uBed,uH,uFish,uPads,uTop,uIceN,uMural; uniform float uPic;
uniform vec2 uRes,uGrid,uMoonPos,uCss; uniform float uTime,uAmb,uCaI,uMoon,uSwell,uFocus,uIce,uSnow,uFog,uStars; uniform vec3 uMoonPh; uniform vec2 uCalm;
uniform vec3 uTint,uCaC,uSky,uSeason;
uniform vec4 uBox[12]; uniform vec4 uBoxB[12]; uniform int uBoxN; uniform vec4 uCrack[6]; uniform float uBroke[6]; uniform vec4 uInk; uniform vec3 uBlot[10]; uniform int uStyle, uPrev; uniform float uGlint; uniform float uLookT,uLeave,uSprite,uDay; uniform vec2 uArt;
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
// ---------- the looks, each drawn from what the water pass has worked out ----------
vec2 gP,gUv,gG,gIa,gRef,gp; float gLap,gH,gLs,gCalm,gIce; vec3 gWater; vec4 gHit;
// winter in a look: how much ice is here (plates afloat included), and where the snow lies on it
float snowOn(){ return smoothstep(.48,.78,fbm(gp*4.+7.))*uSnow*gIce; }
// the fish texture at three blurs: sharp, edge, halo; its colour; and how red it is (the koi's patches)
void fishAt(out vec4 f0,out float fa,out float fb,out float fc,out float red){
  vec2 fuv=gUv+gRef*.25; f0=textureLod(uFish,fuv,0.); fa=textureLod(uFish,fuv,1.).a; fb=textureLod(uFish,fuv,3.2).a; fc=textureLod(uFish,fuv,5.).a;
  vec3 c=f0.rgb/max(f0.a,1e-3); red=clamp((c.r-max(c.g,c.b))*2.2-.4,0.,1.)*f0.a;
}
float blotT(int i){ return uBlot[i].z; }
vec3 lookInk(){
    // the paper: warm, uneven, with fibres
  vec3 paper=vec3(.925,.885,.8)*(.95+.07*fbm(gP*.012))-vec3(.04,.045,.05)*smoothstep(.62,.95,noise(gP*vec2(.9,.04)))-vec3(.025)*smoothstep(.7,1.,noise(gP*vec2(.03,.7)));
  paper*=1.-.18*dot(gUv-.5,gUv-.5);
  vec3 INK=vec3(.075,.07,.065);
  // the fish: a pale wash for the body, dark where the body ends, the scales' patches as darker strokes, red kept as cinnabar
  vec2 fuv=gUv+gRef*.25;
  vec4 f0=textureLod(uFish,fuv,.0); float fa=textureLod(uFish,fuv,1.).a, fb=textureLod(uFish,fuv,3.2).a, fc2=textureLod(uFish,fuv+vec2(.004,.006),4.5).a;
  vec3 fcol=f0.rgb/max(f0.a,1e-3); float lum=dot(fcol,vec3(.3,.59,.11)), red=clamp((fcol.r-max(fcol.g,fcol.b))*2.2-.4,0.,1.)*f0.a;
  float bleed=fbm(gP*.08+3.)*.5+.5;
  float wash=fb*(.32+.2*bleed)+fa*(.18+.55*(1.-lum))*(1.-red);
  float edge=clamp((fa-fb)*2.6,0.,1.)*(.6+.4*bleed);
  float shadow=fc2*.12;
  vec3 ink=paper*(1.-shadow);
  ink=mix(ink,INK,clamp(wash*.8+edge*.75,0.,.95));
  ink=mix(ink,vec3(.72,.2,.13),red*.75);
  // the water: only where it moves, a few grey rings
  ink=mix(ink,INK,smoothstep(.02,.05,-gLap)*.16*(1.-gCalm));
  // pads as broad pale washes with a darker rim; petals, leaves and boats as small strokes
  vec4 pd2=textureLod(uPads,gUv+gG*gIa*.006,gLs+.5); float pr=textureLod(uPads,gUv,gLs+3.).a;
  ink=mix(ink,vec3(.35,.38,.33),pd2.a*(.28+.25*fbm(gP*.05))); ink=mix(ink,INK,clamp((pd2.a-pr)*1.8,0.,.5));
  vec4 tp2=textureLod(uTop,gUv+gG*gIa*.004,gLs); float tl=dot(tp2.rgb/max(tp2.a,1e-3),vec3(.3,.59,.11));
  ink=mix(ink,INK,tp2.a*(.35+.5*(1.-tl)));
  // blots where the paper was touched: ink spreading, fastest at first, the rim darker as it dries
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R2=10.+70.*sqrt(t)*(1.-exp(-t*.9))+18.*t, d=length(gP-b.xy)+(fbm((gP-b.xy)*.06+b.x*.01)-.5)*R2*.55;
    float core=1.-smoothstep(R2*.25,R2,d), rim=exp(-pow((d-R2*.9)/(5.+R2*.08),2.)), halo=1.-smoothstep(R2,R2*1.6,d);
    float dens=exp(-t*.22)*(.5+.5*exp(-t*.5));
    ink=mix(ink,INK,clamp(core*dens*.7+rim*dens*.3+halo*dens*.08,0.,.9));
  }
  // winter: the ice a pale wash, its cracks dry strokes of the brush, the snow paper left white
  if(gIce>0.){ ink=mix(ink,vec3(.95,.93,.88),gIce*.35);
    ink=mix(ink,INK,clamp(gHit.x*(.55+.45*noise(gP*vec2(.5,.08))),0.,.85));
    ink=mix(ink,vec3(.985,.975,.95),snowOn()*.9); }
  return ink;
}
// Ukiyo-e: a woodblock print. Flat Prussian blue in a few bands, the swell as carved contour lines,
// crests as cream foam with a dark rim, everything in flat colour with black key lines, on grained paper.
vec3 lookUkiyo(){
  vec2 P=gP, uv=gUv;
  vec3 paper=vec3(.93,.87,.74)*(.96+.05*fbm(P*.01));
  // the swell bands and their carved lines follow the slow swell, and the water's height only gently, so
  // small ripples (rain, a fish turning) never cut them up; under the type they lie still
  float hs=clamp(gH,-.04,.04)*(1.-gCalm);
  float w=fbm(P*.0022+vec2(uTime*.004,0.))*1.2+hs*4.;
  float band=floor(clamp(w,0.,.999)*3.)/2.;
  vec3 c=mix(vec3(.09,.21,.38),vec3(.2,.39,.55),band);
  float f=fbm(P*.0028+vec2(0.,uTime*.008))*4.+hs*6.;
  float ln=1.-smoothstep(.0,.035,abs(fract(f)-.5)-.44);
  c=mix(c,vec3(.04,.1,.21),ln*.75);
  c=mix(c,vec3(.12,.25,.42),gCalm*.6);
#ifdef CRESTS
  // the print's own water (a picture, in the top half of the look's texture; its crests are in the bottom
  // half): it takes the place of the bands and lines above, bent a little where the water moves
  if(uPic>.5){ vec4 bd=texture(uMural,vec2(uv.x+gG.x*.012,clamp(uv.y+gG.y*.012,.002,.998)*.5)); c=mix(c,bd.rgb/max(bd.a,1e-3)*(1.-gCalm*.07),bd.a); }
#endif
  // foam only on a big crest (a press, a koi breaking the surface), never on the rain's small rings, nor under the type
  float big=(1.-gCalm)*(1.-gCalm), cr=smoothstep(.07,.1,-gLap)*big, rim=clamp(smoothstep(.05,.07,-gLap)*big-cr,0.,1.);
  c=mix(c,vec3(.05,.1,.2),rim*.85); c=mix(c,vec3(.96,.93,.84),cr);
  vec4 pd=textureLod(uPads,uv+gG*gIa*.006,0.); float pe=textureLod(uPads,uv,2.5).a;
  vec3 pc=pd.rgb/max(pd.a,1e-3); pc=vec3(.3,.45,.3)+vec3(.08)*floor(dot(pc,vec3(.33))*3.)/3.;
  // (the print's own leaves and flowers, uArt.x, are laid in as they are: they carry their key line)
  c=mix(c,mix(pc,pd.rgb/max(pd.a,1e-3),uArt.x),step(.5,pd.a)); c=mix(c,vec3(.07,.07,.08),clamp(abs(pd.a-pe)*2.4,0.,1.)*.85*(1.-uArt.x));
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red);
  vec3 fcl=f0.rgb/max(f0.a,1e-3); fcl=floor(fcl*4.+.5)/4.; fcl=mix(fcl,vec3(.96,.93,.84),step(.75,dot(fcl,vec3(.33))));
  fcl=mix(fcl,vec3(.82,.25,.16),step(.4,red/max(f0.a,1e-3)));
  // (koi from the print's own sheet, uSprite, are laid in as they are: they carry their key line)
  c=mix(c,mix(fcl,f0.rgb/max(f0.a,1e-3),uSprite),step(.5,f0.a)*(1.-gCalm*.5*uSprite)); c=mix(c,vec3(.06,.05,.05),clamp((fa-fb)*3.,0.,1.)*(1.-uSprite));
  vec4 tp=textureLod(uTop,uv+gG*gIa*.004,0.); c=mix(c,floor(tp.rgb/max(tp.a,1e-3)*4.)/4.,step(.5,tp.a));
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.||b.z>3.) continue;   // a press: a carved splash, flat cream with a key line
    float t=b.z, life=1.-t/3.; vec2 v=P-b.xy; float d=length(v), an=atan(v.y,v.x), R=12.+64.*sqrt(t);
    // two swells behind the crest, thinning as they go out
    for(int j=1;j<3;j++){ float rj=R-18.*float(j), w=(4.-float(j))*life; if(rj<4.) continue;
      float q=abs(d-rj); c=mix(c,vec3(.05,.1,.2),step(q,w+1.3)); c=mix(c,vec3(.96,.93,.84),step(q,w)); }
#ifdef CRESTS
    // the crest, from the print's own carved wavelets (a picture, uPic once it has come): six round the
    // ring, base to the middle, all breaking the same way, sinking as the splash dies
    if(uPic>.5){ float sc=an*6./6.2832+b.x*.013, wd=6.2832*R/6., ht=wd*.39*(.5+.5*life), vv=(d-R+ht*.25)/max(ht,1.);
      vec4 wv=texture(uMural,vec2((mod(floor(sc)+floor(b.y),4.)*256.+44.+fract(sc)*167.)/1024.,(416.-vv*65.)/1024.+.5))*step(0.,vv)*step(vv,1.)*step(.05,life);
      c=wv.rgb+c*(1.-wv.a); continue; }
#endif
    // the crest breaks into claws: a scalloped edge, each scallop curled forward
    float s=an*14./6.2832+b.x*.013, f=fract(s), jag=noise(vec2(floor(s)*3.1,b.y*.01))*.6+.4;
    float edge=R+11.*jag*f*f*life, inner=R-6.*life-5.*(1.-f)*life;
    c=mix(c,vec3(.05,.1,.2),step(inner-1.4,d)*step(d,edge+1.4)*step(.05,life));
    c=mix(c,vec3(.96,.93,.84),step(inner,d)*step(d,edge)*step(.05,life));
    // spray: a few flecks thrown past the crest
    vec2 cl=vec2(floor(s*2.),floor((d-edge)/6.)); float hh=fract(sin(dot(cl,vec2(12.9898,78.233))+b.x)*43758.5453);
    vec2 fp=vec2((fract(s*2.)-.5)*R*.22,fract((d-edge)/6.)*6.-3.);
    c=mix(c,vec3(.96,.93,.84),step(.8,hh)*step(edge+2.,d)*step(d,edge+18.*life)*step(length(fp),1.9*life+.3)); }
  // winter: flat pale-blue ice with dark key-line cracks, the snow as cream flecks
  if(gIce>0.){ c=mix(c,mix(vec3(.46,.62,.74),vec3(.2,.33,.5),gCalm),step(.5,gIce)); c=mix(c,vec3(.05,.1,.2),step(.3,gHit.x));
    c=mix(c,vec3(.96,.93,.84),step(1.-.1*uSnow,hash1(floor(gP/9.)))*step(.5,gIce)*(1.-gCalm)*step(length(fract(gP/9.)-.5),.24)); }
  c=mix(paper,c,.93);
  c*=.93+.09*noise(P*vec2(.012,.45))+.03*noise(P*vec2(.4,.01));
  return c;
}
// Glow: the pond at night, lit only by what moves. Every ripple glows and fades; the fish are
// bioluminescent, cyan, magenta where they were red; a press bursts into light; faint scan lines.
vec3 lookGlow(){
  vec2 P=gP, uv=gUv;
  vec3 c=vec3(.003,.006,.018)+vec3(.0,.015,.04)*fbm(P*.003);
  float rip=clamp(abs(gLap)*26.+length(gG)*.7,0.,.6)*(1.-gCalm*.8);
  float lit=1.-smoothstep(-90.,90.,length(P-uInk.yz)-(uLookT-.7)*620.); lit*=.55+.45*step(.5,fract(length(P-uInk.yz)/140.-uLookT*1.2))*step(uLookT,3.)+.45*step(3.,uLookT);
  c+=mix(vec3(.05,.55,1.),vec3(.2,1.,.85),.5+.5*sin(P.x*.004+uTime*.2))*rip*.55*lit;
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red);
  c+=(vec3(.05,.9,.85)*fc*.4+vec3(.2,1.,.9)*fb*.55+vec3(.75,1.,.97)*fa*.35)*lit;
  c+=vec3(1.,.12,.65)*red*1.2+vec3(1.,.2,.7)*smoothstep(.1,.5,red)*fb*.3;
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,2.).a;
  c+=vec3(.2,1.,.4)*clamp(abs(pd.a-pe)*2.,0.,1.)*.35+vec3(.0,.05,.03)*pd.a;
  vec4 tp=textureLod(uTop,uv,1.); c+=vec3(.6,.8,1.)*tp.a*.18;
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=20.+160.*sqrt(t), d=length(P-b.xy), k=exp(-t*.9);
    c+=vec3(.2,1.,.95)*exp(-pow((d-R)/(5.+t*6.),2.))*k*1.2+vec3(1.,.25,.8)*exp(-d*d/(600.+t*900.))*k*.9; }
  // winter: the ice as faint cyan sheets whose cracks glow, the snow as dim sparks
  if(gIce>0.){ c+=vec3(.02,.12,.15)*gIce+vec3(.08,.4,.45)*gIce*(1.-gIce)*2.; c+=vec3(.35,1.,.95)*gHit.x*1.3;
    c+=vec3(.6,.9,1.)*step(.9985-.0015*uSnow,hash1(floor(gP/5.)+floor(uTime*2.)))*uSnow*gIce*(1.-gCalm)*.7; }
  c*=.9+.1*step(.5,fract(P.y*.5));
  return c;
}
// Blueprint: a drawing on blue paper. A grid, the fish and the pads as white key lines, the swell as
// contour lines; the dimensions are written on in the air above (drawAir).
vec3 lookBlueprint(){
  vec2 P=gP, uv=gUv;
  vec3 c=vec3(.07,.22,.47)*(.95+.08*fbm(P*.008));
  vec2 q=abs(fract(P/20.)-.5)*20., Q=abs(fract(P/100.)-.5)*100.;
  c=mix(c,vec3(.75,.85,1.),(1.-smoothstep(.0,.8,min(q.x,q.y)))*.08+(1.-smoothstep(.0,.9,min(Q.x,Q.y)))*.16);
  float cl=1.-smoothstep(.0,.05,abs(fract(gH*16.)-.5)-.45); c=mix(c,vec3(.85,.92,1.),cl*smoothstep(.02,.06,abs(gLap)*4.+abs(gH)*.6)*.14*(1.-gCalm*.9));
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.5).a;
  c=mix(c,vec3(.92,.96,1.),clamp(abs(pd.a-pe)*3.,0.,1.)*.8);
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red);
  float fe=clamp((fa-fb)*3.4,0.,1.); c=mix(c,vec3(.96,.98,1.),fe); c=mix(c,vec3(.85,.92,1.),fb*.06);
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,vec3(.92,.96,1.),clamp(abs(tp.a-te)*3.,0.,1.)*.7);
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=12.+50.*sqrt(t), d=length(P-b.xy), k=exp(-t*.4);
    vec2 v=abs(P-b.xy);
    c=mix(c,vec3(.95,.98,1.),(exp(-pow((d-R)/1.,2.))+ (1.-smoothstep(.5,1.,min(v.x,v.y)))*step(max(v.x,v.y),R*1.25)*.8)*k); }
  // winter: the ice hatched, its cracks drawn with a dashed line beside them as a dimension is, the snow as small crosses
  if(gIce>0.){ c=mix(c,vec3(.85,.92,1.),step(abs(fract((gP.x+gP.y)/10.)-.5),.06)*gIce*.35);
    c=mix(c,vec3(.96,.98,1.),clamp(gHit.x*1.2,0.,1.));
    c=mix(c,vec3(.85,.92,1.),step(abs(gHit.w-6.),.5)*step(.5,fract((gP.x+gP.y)*.09))*.7);
    vec2 cc=fract(gP/16.)-.5; float cr=clamp(step(abs(cc.x),.03)*step(abs(cc.y),.18)+step(abs(cc.y),.03)*step(abs(cc.x),.18),0.,1.);
    c=mix(c,vec3(.95,.98,1.),cr*step(1.-.35*uSnow,hash1(floor(gP/16.)))*step(.5,gIce)); }
  // the drawing is plotted in line first, over what was there, a row at a time behind the rule; the paper's
  // blue floods in after
  float fill=smoothstep(.25,.9,uLookT-gP.y/uCss.y*1.5);
  if(fill<1.){ float ln=smoothstep(.1,.32,dot(c-vec3(.07,.22,.47),vec3(.333))); c=mix(mix(gWater*.3,vec3(.92,.96,1.),ln),c,fill); }
  return c;
}
// ASCII: the picture the characters are made from (the glass pass turns it into text). The bed is
// flat and dark, so it reads as blank; what moves carries the picture: ripples, koi, pads and petals.
vec3 lookAscii(){
  vec2 uv=gUv;
  vec3 c=vec3(.01,.016,.018)+vec3(.0,.012,.012)*gCalm;
  float rip=clamp(abs(gLap)*30.+length(gG)*.8,0.,.8)*(1.-gCalm*.85);
  c+=vec3(.32,.5,.52)*rip*.55;
  vec4 pd=textureLod(uPads,uv+gG*gIa*.006,0.); c=mix(c,pd.rgb/max(pd.a,1e-3)*.5,pd.a*.85);
  vec4 f=textureLod(uFish,uv+gRef*.3,0.); c=mix(c,f.rgb/max(f.a,1e-3),f.a);
  vec4 tp=textureLod(uTop,uv,0.); c=mix(c,tp.rgb/max(tp.a,1e-3)*.9,tp.a*.9);
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=10.+90.*sqrt(t), d=length(gP-b.xy); c+=vec3(.55,.8,.8)*exp(-pow((d-R)/6.,2.))*exp(-t*.8); }
  // winter: the ice a grey field that types as dots, its cracks bright, the snow dense
  if(gIce>0.){ float k=1.-gCalm*.9; c=mix(c,vec3(.1,.13,.15),gIce*.5*k); c+=vec3(.7,.85,.9)*gHit.x; c=mix(c,vec3(.6,.66,.66),step(.993,hash1(floor(gP/17.)))*uSnow*gIce*k); }
  return c;
}
vec3 look(int s){
  if(s==1) return lookInk();
  if(s==2) return lookUkiyo();
  if(s==3) return lookGlow();
  if(s==4) return lookBlueprint();
  if(s==5) return lookAscii();
  return gWater;
}
// How far the front has come over this pixel (1 inside), and how bright its leading edge is here.
float reveal(int s,out float e){
  if(uInk.w<.3){ e=0.; return smoothstep(0.,1.,uInk.x); }
  vec2 P=gP; float R=uInk.x, r, w=40.;
  if(s==1){ float fib=fbm(P*.03)*.55+noise(P*.21)*.25+noise(P*vec2(1.1,.06))*.12+noise(P*vec2(.05,1.3))*.08;
    r=length(P-uInk.yz)+(fib-.5)*150.+(noise(P*.012+R*.003)-.5)*120.; }
  // the print: a carved wave sweeps across from the top left as it is pulled off the block
  else if(s==2){ float t=P.x-P.y; r=(P.x+P.y)*.7071+(noise(P*vec2(.02,.004))-.5)*26.+sin(t*.012)*18.+sin(t*.031)*6.; w=6.; }
  else if(s==4){ r=P.y; w=2.; }                                                 // a scan from the top
  // glow: the lights go out in a long soft falloff
  else if(s==3){ r=length(P-uInk.yz)+(noise(P*.006)-.5)*60.; w=90.; }
  // ASCII: the picture turns to characters a cell at a time, scattering out from where the typing was
  else if(s==5){ vec2 q=floor(P/vec2(9.,18.)); r=length(q*vec2(9.,18.)-uInk.yz)+(hash1(q)-.5)*190.; w=1.; }
  // oil: broad strokes laid across the scene a few at a time, nearest first, until it is covered
  else if(s==6){ vec2 q=(P+vec2(noise(P*.021)*70.,noise(P*.027+5.)*34.))/vec2(170.,44.); q.x+=step(1.,mod(floor(q.y),2.))*.5; vec2 f=fract(q)-.5;
    r=length(P-uInk.yz)*.8+(hash1(floor(q))-.5)*320.+dot(f*f,vec2(150.,170.))+(noise(P*.2)-.5)*26.; w=18.; }
  // 青花: the glaze flows in from the rim towards the middle
  else if(s==7){ float ed=min(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y)); r=ed/(.5*min(uCss.x,uCss.y))*length(uCss)*.5+(fbm(P*.008)-.5)*90.; w=46.; }
  // 敦煌: dust brushed away from where the wall was rubbed, raggedly
  else if(s==8){ r=length(P-uInk.yz)+(fbm(P*.018)-.5)*190.+(noise(P*.22)-.5)*34.; w=22.; }
  // the stars: dusk falls from the top of the sky
  else if(s==9){ r=P.y/uCss.y*length(uCss)*.5+(noise(P*.004)-.5)*50.; w=170.; }
  // the relief: sand blown off the stone, in long streaks down the wind
  else if(s==10){ r=length(P-uInk.yz)+(fbm(P*vec2(.004,.045)+3.)-.5)*300.+(noise(P*vec2(.03,.5))-.5)*46.; w=34.; }
  else { r=length(P-uInk.yz)+(noise(P*.01)-.5)*30.; w=30.; }
  e=exp(-pow((r-R)/(s==1?38.:s==4?3.:s==2?10.:14.),2.))*step(1.,R)*(1.-step(.999,uInk.w));
  return 1.-smoothstep(R-w,R+w,r);
}
vec3 edgeCol(int s){
  if(s==1) return vec3(.075,.07,.065)*.55;
  if(s==2) return vec3(1.,.97,.88);
  if(s==3) return vec3(.3,1.,.95)*1.4;
  if(s==4) return vec3(.7,.95,1.)*1.3;
  if(s==6) return vec3(.95,.9,.8)*.25;      // wet paint at a stroke's edge
  if(s==7) return vec3(.12,.25,.7);         // the cobalt blooming into the glaze
  if(s==8) return vec3(.86,.74,.52);        // dust
  if(s==9) return vec3(.3,.25,.45)*.5;      // the last of the dusk
  if(s==10) return vec3(.88,.80,.62);       // sand
  return vec3(.85,.95,1.)*.6;
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
#if PART==2
  // a look that has come in all the way covers the water, and draws only from what is worked out above:
  // the water's own colour isn't needed (the same picture, for much less work)
  {
    gP=P; gUv=uv; gG=g; gIa=ia; gRef=ref; gLap=lap; gH=h; gLs=ls; gCalm=calm; gWater=vec3(0.); gp=p; gHit=hit;
    gIce=max(ice,hit.y>0.?smoothstep(0.,.25,hit.z)*hit.y:0.);
    o=vec4(look(uStyle),1.); return;
  }
#endif
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
  if(up>0.){   // (with the focus up close, as it mostly is, there's nothing of it to see)
    vec2 rp=p*1.25+g*3.2+vec2(uTime*.008,0.);
    float canopy=smoothstep(.5,.62,fbm(rp*2.3+3.)), cloud=fbm(rp*.9+vec2(uTime*.015,5.));
    col=mix(col,mix(uSky*.85,vec3(1.),cloud*.55)*(1.-canopy*.84),up*.56);
  }
  vec3 n=normalize(vec3(-g*5.,1.)); vec3 hv=normalize(normalize(vec3(-.45,-.55,.7))+vec3(0.,0.,1.));
  float spec=pow(max(dot(n,hv),0.),90.)*(1.-ice);
  col=mix(col,uSky,clamp(length(g)*2.2,0.,1.)*.26*(1.-ice));
  col+=uSky*spec*.85;
  vec2 md=(uv-uMoonPos)*vec2(asp,1.)+g*2.4;
  // the sun's glint by day where the moon's light lies at night: pressed, the lights go out (glow)
  col+=uGlint*(1.-uMoon)*(1.-ice*.7)*(vec3(1.,.98,.92)*smoothstep(.022,.006,length(md))*.55+vec3(1.,.95,.85)*exp(-dot(md,md)*160.)*.22);
  // the moon's phase (uMoonPh: how much is lit, and which side): the dark part of the disc is cut away
  float mlit=smoothstep(-.12,.12,uMoonPh.y*md.x/.034-(1.-2.*uMoonPh.x));
  col+=uMoon*(1.-ice*.7)*(vec3(.95,.97,1.)*smoothstep(.05,.018,length(md))*.6*mlit+vec3(.5,.62,.85)*exp(-dot(md,md)*60.)*.3*(.2+.8*uMoonPh.x));
  // stars on a clear night, a few, shaken by the ripples
  if(uStars>0.){ vec2 sp=(P+g*40.)/6., sc=floor(sp); float st=step(.9965,hash1(sc+7.1))*(.55+.45*sin(uTime*2.3+hash1(sc)*40.));
    col+=vec3(.82,.88,1.)*st*smoothstep(1.,.25,length(fract(sp)-.5)*6.)*uStars*(1.-ice)*(1.-calm*.8)*.9; }
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
  // fog: a soft haze over the water
  col=mix(col,vec3(.55,.61,.63)*(uAmb*.6+.4),uFog*.36);
  // ---------- the looks: a front brings one look in over another (ink, ukiyo-e, glow, blueprint) ----------
#if PART!=1
  if(uInk.w>0.){
    gP=P; gUv=uv; gG=g; gIa=ia; gRef=ref; gLap=lap; gH=h; gLs=ls; gCalm=calm; gWater=col; gp=p; gHit=hit;
    gIce=max(ice,hit.y>0.?smoothstep(0.,.25,hit.z)*hit.y:0.);
    float e; float m=reveal(uStyle,e);
    vec3 top=look(uStyle), base=m<.999?look(uPrev):top;
    col=mix(base,top,m);
#ifdef CRESTS
    // (the print's front is a wave, not a line of light, once its crests have come)
    if(uStyle==2&&uPic>.5) e*=.2;
#endif
    col=mix(col,edgeCol(uStyle),e);
#ifdef CRESTS
    // the print's front carries its great crests (the same picture), standing on the front and rising ahead of it
    if(uStyle==2&&uPic>.5&&uInk.w>=.3&&uInk.w<.999&&uInk.x>1.){
      float ft=(P.x-P.y)*.7071, fr=(P.x+P.y)*.7071+(noise(P*vec2(.02,.004))-.5)*26.+sin((P.x-P.y)*.012)*18.+sin((P.x-P.y)*.031)*6.;
      // (it comes out of the corner already a wave, and grows to its full height as it crosses)
      float ht=min(210.,uCss.y*.28)*(.5+.5*smoothstep(0.,300.,uInk.x)), vv=(fr-uInk.x+ht*.12)/max(ht,1.), sc=ft/(ht*1.09+1.);
      // behind it the water it leaves is still running: foam thinning out, and a row of low wavelets following
      float back=(uInk.x-fr)/ht;
      col=mix(col,vec3(.96,.93,.84),(1.-smoothstep(0.,.5,back))*step(0.,back)*.55);
      float v2=(fr-uInk.x+ht*.95)/(ht*.42), s2=ft/(ht*.86+1.)+.5;
      vec4 w2=texture(uMural,vec2((mod(floor(s2),4.)*256.+44.+fract(s2)*167.)/1024.,(416.-v2*65.)/1024.+.5))*step(0.,v2)*step(v2,1.);
      col=w2.rgb+col*(1.-w2.a);
      vec4 wv=texture(uMural,vec2((mod(floor(sc),4.)*256.+20.+fract(sc)*215.)/1024.,(227.-vv*198.)/1024.+.5))*step(0.,vv)*step(vv,1.);
      col=wv.rgb+col*(1.-wv.a);
    }
#endif
    // the moon in a look, at night: a pale wash in ink, a cream disc in the print, a lit disc in glow,
    // a drawn circle in the blueprint, a bright round in ASCII
    if(uMoonPh.z>0.&&uMoon>.01&&uStyle>0){
      float dm=length(md), disc=smoothstep(.036,.03,dm)*mlit;
      if(uStyle==4) disc=smoothstep(.0016,0.,abs(dm-.033));
      vec3 mc=uStyle==1?vec3(.82,.8,.74):uStyle==2?vec3(.96,.93,.84):uStyle==3?vec3(.7,1.,.98):uStyle==4?vec3(.95,.98,1.):vec3(.9);
      col=mix(col,mc,disc*uMoon*m);
      if(uStyle==3) col+=vec3(.2,.6,.6)*exp(-dm*dm*900.)*uMoon*m*uMoonPh.x;
    }
  }
#endif
  o=vec4(col,1.);
}`;
// The water pass is built three ways from the one source: all of it (PART 0), for while a look comes in or
// goes; the water alone (1), with no look shown; and a look alone (2), once one has come in all the way and
// covers the water. Each draws exactly what the whole would, without the work that wouldn't be seen.
// A look alone is built for that one look (ONLY), so each is a pass of its own with none of the others in it.
const FS = FS_SRC.replace('vec3 look(int s){', `${NEW_GLSL}vec3 look(int s){\n#ifdef ONLY\n  s=ONLY;\n#endif\n  if(s>=6) return lookNew(s);\n`);
const fsPart = (n, only) => FS.replace('\n', `\n#define PART ${n}\n#define CRESTS\n${only ? `#define ONLY ${only}\n` : ''}`);
// The second pass. Inside a pane the picture is blurred and smoked; towards the rim it is
// pulled sideways as through the edge of a lens, and the rim itself catches the light. In
// the cold, frost gathers along the rim.
const GLASS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uScene,uAtlas,uBlur,uShade; uniform vec2 uCss,uCell; uniform vec3 uSh0,uSh1; uniform float uShK; uniform float uLod,uFrost; uniform vec4 uAscii; uniform vec3 uGlass;
uniform vec4 uPane[12]; uniform vec4 uPaneB[12]; uniform int uPaneN;
float sd(vec2 p,vec4 b,float r){ vec2 q=abs(p-b.xy)-b.zw+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
vec3 scene(vec2 P,float lod){ return textureLod(uScene,vec2(P.x/uCss.x,1.-P.y/uCss.y),lod).rgb; }
// the soft copy the glass blurs: a quarter-size picture of the pond, with its own smaller copies
vec3 soft(vec2 P,float lod){ return textureLod(uBlur,vec2(P.x/uCss.x,1.-P.y/uCss.y),max(lod-2.,0.)).rgb; }
float grain(vec2 P){ return fract(sin(dot(floor(P),vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 P=vUv*uCss; vec3 col=scene(P,0.);
  // ASCII: each cell a character, picked by how bright the picture is there, in its colour; inside the
  // front coming in (w 1), outside the one going (w -1)
  if(uAscii.w!=0.){
    float inF=1.-smoothstep(uAscii.x-30.,uAscii.x+30.,length(P-uAscii.yz)), m=uAscii.w>0.?inF:1.-inF;
    if(m>0.){
      vec2 id=floor(P/uCell), cp=(id+.5)*uCell;
      vec3 sc=(scene(cp,0.)*2.+scene(cp+uCell*vec2(.25,.25),0.)+scene(cp-uCell*vec2(.25,.25),0.))/4.;
      float l=dot(sc,vec3(.3,.59,.11)), g=floor(clamp(pow(l*1.25,.85),0.,.999)*10.);
      vec2 fq=fract(P/uCell); float a=texture(uAtlas,vec2((g+fq.x)/10.,fq.y)).a;
      vec3 tint=sc/max(max(sc.r,max(sc.g,sc.b)),.08); tint=mix(vec3(.72,.86,.82),tint,.7);
      col=mix(col,vec3(.01,.016,.018)+tint*a*(.5+.7*clamp(l*1.6,0.,1.)),m);
    }
  }
  for(int i=0;i<12;i++){ if(i>=uPaneN) break; vec4 b=uPane[i]; float r=uPaneB[i].x,a=uPaneB[i].y;
    float d=sd(P,b,r); if(d>1.||a<.004) continue;
    vec2 n=vec2(sd(P+vec2(1.,0.),b,r)-sd(P-vec2(1.,0.),b,r),sd(P+vec2(0.,1.),b,r)-sd(P-vec2(0.,1.),b,r)); n/=max(length(n),1e-4);
    float e=smoothstep(-24.,0.,d); e*=e;
    vec2 Q=P-n*e*24.;
    vec3 g=(soft(Q,uLod)*2.+soft(Q+vec2(7.,5.),uLod-.7)+soft(Q+vec2(-6.,6.),uLod-.7)+soft(Q+vec2(5.,-7.),uLod-.7)+soft(Q+vec2(-7.,-5.),uLod-.7))/6.;
    g=mix(g,uGlass,.43)*1.05;
    g+=vec3(.055)*(1.-clamp((P.y-(b.y-b.w))/(2.*b.w),0.,1.));
    float rim=smoothstep(-3.2,-.4,d), lit=clamp(dot(n,normalize(vec2(-.55,-.83))),0.,1.), dark=clamp(dot(n,normalize(vec2(.55,.83))),0.,1.);
    g+=vec3(.92,1.,1.)*rim*(.07+.36*lit*lit);
    g-=vec3(.09)*rim*dark;
    g+=vec3(1.)*e*.035;
    float fr=smoothstep(-38.,-2.,d); g=mix(g,vec3(.86,.93,.97),uFrost*fr*fr*(.12+.5*grain(P*.7)*grain(P*.31+3.)));
    col=mix(col,g,smoothstep(.7,-.7,d)*a);
  }
  // the shade of a tree over everything, swaying (it multiplies, as the shade over the water always did)
  col*=mix(vec3(1.),texture(uShade,vec2(dot(uSh0,vec3(P,1.)),dot(uSh1,vec3(P,1.)))).rgb,uShK);
  o=vec4(col,1.);
}`;
let gl,
  prog,
  bedProg,
  glassProg,
  U = {},
  progs = [],
  progOK = [],
  progU = new Map(),
  pcx = null,
  progAts = [],
  passNow = 0,
  UG = {},
  texH,
  texFish,
  texPads,
  texBed,
  texTop,
  texIce,
  texScene,
  texBlur,
  texShade,
  blurFbo,
  blurW = 1,
  blurH = 1,
  upKey = '',
  fbo,
  sceneFbo,
  glOK = false,
  glDpr = 1;
function sh(type, src, later) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!later && !gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function mk(fs, later) {
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS, later));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs, later));
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!later && !gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
// the water pass's uniforms, looked up once a build is ready (asking sooner would wait for it)
const FS_U = [
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
  'uBlot',
  'uStyle',
  'uPrev',
  'uGlint',
  'uFog',
  'uLookT',
  'uLeave',
  'uMural',
  'uFace',
  'uPic',
  'uSprite',
  'uDay',
  'uArt',
  'uStars',
  'uMoonPh'
];
const locs = (p) => Object.fromEntries(FS_U.map((n) => [n, gl.getUniformLocation(p, n)]));
// Which build of the water pass draws this frame: a part is used once it has been built (asked without
// waiting where the browser can say, else after a few seconds); one that failed is never used.
function waterProg(part) {
  // the whole pass and a look's own are asked for the first time they are needed
  if (!progs[part]) {
    progs[part] = mk(part ? fsPart(2, part - 1) : fsPart(0), true);
    progAts[part] = performance.now();
  }
  const p = progs[part];
  if (progOK[part] === undefined) {
    // (until it is built: the whole pass if that is, which draws anything; else the water, as it was)
    if (pcx ? !gl.getProgramParameter(p, pcx.COMPLETION_STATUS_KHR) : performance.now() - progAts[part] < 1500) return part && progOK[0] ? progs[0] : prog;
    progOK[part] = !!gl.getProgramParameter(p, gl.LINK_STATUS);
    if (progOK[part]) progU.set(p, locs(p));
  }
  return progOK[part] ? p : part && progOK[0] ? progs[0] : prog;
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
  // Only the water alone is built before the first frame: it is all the first screen shows, and the whole
  // pass, with every look in it, takes several times as long to build (seconds, where the GPU is software).
  // The whole is built in the background once the pond has settled, or the moment a look is first asked
  // for; each look alone when it is first asked for.
  prog = mk(fsPart(1));
  bedProg = mk(BED);
  glassProg = mk(GLASS);
  progs = [null, prog];
  progOK[1] = true;
  pcx = gl.getExtension('KHR_parallel_shader_compile');
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  progU.set(prog, locs(prog));
  U = progU.get(prog);
  for (const n of [
    'uScene',
    'uCss',
    'uLod',
    'uFrost',
    'uGlass',
    'uPane',
    'uPaneB',
    'uPaneN',
    'uAscii',
    'uCell',
    'uAtlas',
    'uBlur',
    'uShade',
    'uSh0',
    'uSh1',
    'uShK'
  ])
    UG[n] = gl.getUniformLocation(glassProg, n);
  texH = tex(gl.LINEAR);
  texIce = tex(gl.LINEAR);
  texFish = deep();
  texPads = deep();
  texBed = deep();
  texTop = deep();
  // the scene is read sharp; the glass blurs a quarter-size copy of it, which keeps the smaller copies
  texScene = tex(gl.LINEAR);
  texBlur = deep();
  texShade = tex(gl.LINEAR);
  fbo = gl.createFramebuffer();
  sceneFbo = gl.createFramebuffer();
  blurFbo = gl.createFramebuffer();
  glOK = true;
  tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  {
    // the texture a look's own picture lies in: empty until a look that has one is asked for
    gl.activeTexture(gl.TEXTURE10);
    texMural = tex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.activeTexture(gl.TEXTURE0);
  }
}
function sizeGL() {
  // at most 1.5 pixels to a CSS pixel, at most about two megapixels in all, and less if frames run slow
  const dpr = (glDpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2e6 / (W * H))) * quality);
  glc.width = Math.round(W * dpr);
  glc.height = Math.round(H * dpr);
  const fs = big ? 0.8 : 1;
  fishCv.width = topCv.width = Math.round(W * fs);
  fishCv.height = topCv.height = Math.round(H * fs);
  padCv.width = Math.round(W * Math.min(dpr, 1.25));
  padCv.height = Math.round(H * Math.min(dpr, 1.25));
  adpr = Math.min(window.devicePixelRatio || 1, 1.5);
  air.width = Math.round(W * adpr);
  air.height = Math.round(H * adpr);
  padKey = '';
  padsNow();
  if (!glOK) return;
  paintPic();
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
  blurW = Math.max(1, Math.ceil(glc.width / 4));
  blurH = Math.max(1, Math.ceil(glc.height / 4));
  gl.bindTexture(gl.TEXTURE_2D, texBlur);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, blurW, blurH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, blurFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texBlur, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  upKey = '';
  shadeTex();
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
// The panes are read from the page only while something there is moving (a transition, an animation,
// a resize or a scroll); otherwise the last reading stands, and the frame touches no style or layout.
let panesUntil = 0;
const panesLive = () => (panesUntil = performance.now() + 700),
  panesFor = (ms) => (panesUntil = Math.max(panesUntil, performance.now() + ms));
for (const ev of ['transitionrun', 'transitionend', 'animationstart', 'animationend', 'scroll'])
  addEventListener(
    ev,
    (e) => {
      // the koi's name tags fade in and out over the water all the time: they move no pane
      if (e.target.closest?.('#tags, .bars')) return;
      panesLive();
      invalidate();
    },
    { capture: true, passive: true }
  );
addEventListener('resize', panesLive);
// The panes are read only while something says they may move. A browser can move them and say nothing: a
// phone's in-app browser hides its bars or changes the safe area with no resize event, and the glass was
// then drawn where the controls had been. So twice a second one control's place is looked at, and if it
// isn't where the glass was last drawn for it, the panes are read again.
let paneSeen = '',
  paneLooked = 0;
const paneAt = () => {
  const el = paneEls.find((e) => e.id === 'cmdBtn') || paneEls[0];
  if (!el) return '';
  const r = el.getBoundingClientRect(),
    pr = pond.getBoundingClientRect();
  return `${Math.round(r.left - pr.left)} ${Math.round(r.top - pr.top)} ${Math.round(r.width)} ${Math.round(pr.width)} ${Math.round(pr.height)}`;
};
function panesMoved(now) {
  if (now - paneLooked < 500) return;
  paneLooked = now;
  if (paneAt() === paneSeen) return;
  // (the pond itself may be another size: the water is fitted to it again before the glass is read)
  const pr = pond.getBoundingClientRect();
  if (Math.abs(pr.width - W) > 0.5 || Math.abs(pr.height - H) > 0.5) fit();
  panesLive();
}
function panes() {
  if (performance.now() > panesUntil) return;
  paneSeen = paneAt();
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
  raining = false,
  // the weather where the visitor is (weather.ts), and what it does to the pond; a visitor's own rain wins
  wx = null,
  fx = effectsOf('clear'),
  rainChosen = false,
  flashAt = -99;
// how far through the day it is where the visitor is, 0 to 1 (a time of day chosen by hand stands for its hour)
const dayNow = () =>
  phaseChoice !== 'auto'
    ? { dawn: 0.27, day: 0.5, dusk: 0.73, night: 0 }[phase]
    : (wx ? minutesAt(wx.timeZone) : new Date().getHours() * 60 + new Date().getMinutes()) / 1440;
const autoPhase = () => {
  if (wx) return phaseAt(minutesAt(wx.timeZone), wx.sunrise, wx.sunset);
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
  hintSoon(1800);
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
    q.vx += (-gx * 1100 + pv.windX * wind - q.vx * 1.2) * dt;
    q.vy += (-gy * 1100 + pv.windY * wind - q.vy * 1.2) * dt;
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
  const drift = artOf('afloat');
  for (const b of boats) {
    c.save();
    c.globalAlpha = b.a;
    c.translate(b.x, b.y);
    c.rotate((b.r * Math.PI) / 180);
    if (drift?.boats) {
      cellAt(c, drift.pic, drift.boats[Math.floor(Math.abs(b.x0 ?? b.r) * 7) % drift.boats.length], 64);
      c.restore();
      continue;
    }
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
    if (drift?.petals) {
      cellAt(c, drift.pic, drift.petals[Math.floor(q.s * 97) % drift.petals.length], 26);
      c.restore();
      continue;
    }
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
    if (drift?.leaves) {
      cellAt(c, drift.pic, drift.leaves[q.kind % drift.leaves.length], 34);
      c.restore();
      continue;
    }
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
  drawFestival(c);
  drawBugs(c);
  drawSpider(c);
}
// The festivals, on the water: a few red lanterns at the Spring Festival, river lanterns at Mid-Autumn,
// a dragon boat far off now and then at Dragon Boat. Drawn with the top layer, ten times a second.
let festAt = 0;
// The festivals' own pictures (public/pond/water/): the dragon boat in two paddling frames, the two
// lanterns. Each is asked for the first time its festival draws, and what is drawn in code stands until
// it has come, or for good if it never does.
const festPics = {},
  FEST_PICS = { 'dragon-boat': '/pond/water/dragon-boat.webp', lanterns: '/pond/water/lanterns.webp' };
function festPic(name) {
  if (!settledNow) return null;
  if (!(name in festPics)) {
    festPics[name] = null;
    const im = new Image();
    im.onload = () => {
      festPics[name] = im;
      invalidate();
    };
    // (not having the picture is no fault: the drawn one is kept)
    im.onerror = () => {};
    im.src = FEST_PICS[name];
  }
  return festPics[name];
}
function drawFestival(c) {
  const now = performance.now() / 1000,
    dt = Math.min(0.5, now - (festAt || now));
  festAt = now;
  const f = pv.fest;
  if ((f === 'spring' || f === 'midautumn') && pv.lanterns.length === 0)
    pv.lanterns = Array.from({ length: f === 'spring' ? 4 : 6 }, () => ({ x: rnd(0.5, 0.95) * W, y: rnd(0.15, 0.85) * H, p: rnd(0, TAU) }));
  if (f !== 'spring' && f !== 'midautumn') pv.lanterns = [];
  for (const q of pv.lanterns) {
    q.x += (pv.windX * 0.35 + Math.sin(now * 0.3 + q.p) * 3) * dt;
    q.y += (pv.windY * 0.35 + Math.cos(now * 0.25 + q.p) * 2) * dt;
    if (q.x > W + 30) q.x = W * 0.45;
    if (q.y > H + 30) q.y = H * 0.1;
    const lamp = festPic('lanterns');
    if (lamp) {
      // from the picture: the river lantern with the light the pond gives it, or the red paper one
      if (f !== 'spring') {
        const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, 30);
        g.addColorStop(0, 'rgba(255,214,140,0.6)');
        g.addColorStop(1, 'rgba(255,170,80,0)');
        c.fillStyle = g;
        c.fillRect(q.x - 30, q.y - 30, 60, 60);
      }
      c.drawImage(shrunk(lamp, 0.5), f === 'spring' ? 128 : 0, 0, 128, 128, q.x - 22, q.y - 22, 44, 44);
      continue;
    }
    c.save();
    c.translate(q.x, q.y);
    c.scale(1.5, 1.5);
    if (f === 'spring') {
      // a red paper lantern seen from above: a round with gold at its top and a tassel
      c.fillStyle = 'rgba(206,40,32,0.92)';
      c.beginPath();
      c.ellipse(0, 0, 9, 8, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(120,20,16,0.6)';
      c.lineWidth = 0.8;
      for (const k of [-4, 0, 4]) {
        c.beginPath();
        c.ellipse(k * 0.6, 0, Math.abs(k) ? 6 : 1, 8, 0, 0, TAU);
        c.stroke();
      }
      c.fillStyle = '#e8b04a';
      c.fillRect(-4, -9.5, 8, 2.5);
      c.fillRect(-4, 7.2, 8, 2.5);
    } else {
      // a river lantern: a little paper lotus with a warm light in it
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,214,140,0.7)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 16, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(250,236,214,0.95)';
      for (let i = 0; i < 6; i++) {
        c.rotate(TAU / 6);
        c.beginPath();
        c.ellipse(0, -5, 2.6, 5, 0, 0, TAU);
        c.fill();
      }
      c.fillStyle = '#ffcf6e';
      c.beginPath();
      c.arc(0, 0, 2.2, 0, TAU);
      c.fill();
    }
    c.restore();
  }
  if (f === 'dragon') {
    // far off near the top: once every few minutes, a slow crossing of some forty seconds
    if (now - pv.boatAt > 200) pv.boatAt = now;
    const k = (now - pv.boatAt) / 40;
    const boat = festPic('dragon-boat');
    if (k < 1 && boat) {
      // from the picture, a quarter of its size: the two frames of the stroke in turn, to the drum's beat,
      // and a wake in the water behind it
      const bx = -160 + k * (W + 320),
        by = H * 0.16,
        frame = Math.floor(now / 0.55) % 2;
      c.drawImage(shrunk(boat, 0.25), 0, frame * 64, 256, 64, bx - 128, by - 32, 256, 64);
      if (now - pv.wakeAt > 0.35) {
        pv.wakeAt = now;
        drop(bx - 118, by, 2.2, 0.5);
      }
    } else if (k < 1) {
      c.save();
      c.translate(-160 + k * (W + 320), H * 0.16);
      c.scale(1.7, 1.7);
      c.fillStyle = 'rgba(178,34,30,0.9)';
      c.beginPath();
      c.moveTo(-70, 0);
      c.quadraticCurveTo(0, -9, 70, -2);
      c.quadraticCurveTo(0, 9, -70, 0);
      c.fill();
      // the dragon's head at the bow and the tail at the stern, in gold
      c.fillStyle = '#d9a640';
      c.beginPath();
      c.moveTo(70, -2);
      c.lineTo(84, -7);
      c.lineTo(80, 2);
      c.closePath();
      c.fill();
      c.fillRect(-76, -2, 7, 3);
      c.fillStyle = 'rgba(40,24,18,0.75)';
      for (let i = -50; i <= 50; i += 12) {
        c.beginPath();
        c.arc(i, 0, 1.8, 0, TAU);
        c.fill();
      }
      c.restore();
    }
  }
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

/* ================= Devot's dove and ocra's spider, as rendered sprites ================= */
// The two are drawn from sprite sheets (sprites.js), each fetched the first time its creature is to be
// drawn; until the pond has settled, and until a sheet has come, the pond does without them.
let life = null,
  lifeDt = 0.016;
// the light the time of day gives a sprite, in steps coarse enough that a sheet is dressed again only now and then
const spriteLight = () => {
  const q = (i) => Math.round((0.5 + 0.5 * (cur ? cur.tint[i] : 1)) * (0.3 + 0.7 * (cur ? cur.amb : 1)) * 16) * 16;
  return `rgb(${Math.min(255, q(0))},${Math.min(255, q(1))},${Math.min(255, q(2))})`;
};
// one cell of a creature's sheet, laid where it stands and turned to its heading, on the soft shadow the
// ground gave the model where the look keeps its light
function drawCell(c, which, [row, i], x, y, a, half, shadow) {
  const n = SPRITES[which].cell,
    sheet = artOf(which) ? null : life.pic(which, look, spriteLight());
  // (its own picture in this look, or the rendered sheet; nothing until one has come)
  if (!artOf(which) && !sheet) return;
  c.save();
  c.translate(x, y);
  if (shadow > 0 && litLook(look)) {
    const g = c.createRadialGradient(half * 0.05, half * 0.08, 0, half * 0.05, half * 0.08, half * 0.5);
    g.addColorStop(0, `rgba(8,20,22,${0.42 * shadow})`);
    g.addColorStop(1, 'rgba(8,20,22,0)');
    c.fillStyle = g;
    c.fillRect(-half, -half, half * 2, half * 2);
  }
  c.rotate(a);
  // the look's own picture of it, where it has one: at rest, half way and spread along a row, or one pose
  const own = artOf(which);
  if (own) {
    const pose =
        own.poses === 1
          ? 0
          : which === 'dove'
            ? row === 0
              ? 0
              : row === 2
                ? i < 2 || i > 5
                  ? 2
                  : 1
                : 1
            : row === 3
              ? 2
              : row === 1
                ? i % 4 < 2
                  ? 1
                  : 0
                : 0,
      m = own.pic.naturalHeight;
    c.drawImage(own.pic, pose * m, 0, m, m, -half, -half, half * 2, half * 2);
    c.restore();
    return;
  }
  const [sx, sy] = frameAt(which, row, i);
  laidIn(c, () => c.drawImage(sheet, sx, sy, n, n, -half, -half, half * 2, half * 2));
  c.restore();
}

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
  // what has its eye: prey, or a pointer that has just moved close by
  spider.alert = !!spider.prey || (ptr.moved && T - ptr.at < 1.5 && Math.hypot(ptr.x - spider.x, ptr.y - spider.y) < 160);
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
      // in strides: the sprite's walk is one loop to half a unit of the spider's own size
      spider.gone = ((spider.gone || 0) + (44 * dt) / (S * 0.23)) % 1;
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
// ---------- the looks: water, ink (墨), ukiyo-e, glow, blueprint and ASCII ----------
// A front brings a look in over the one before (`top` over `base`); going back to the water, the front
// draws in again. Ink: a drop from the switch spreads and turns the pond to paper, and time slows.
// The other looks are found by gestures on the water (`gest`, below) or by searching ⌘K.
const LOOKS = ['water', 'ink', 'ukiyo', 'glow', 'blueprint', 'ascii', ...NEW_LOOKS],
  SID = { water: 0, ink: 1, ukiyo: 2, glow: 3, blueprint: 4, ascii: 5, ...NEW_SID };
// The looks' own type and Japanese (looks.css: kana.css and the looks' faces) load the first time a
// look or 日 is chosen, so a first visit costs no more than the water and the brush.
let typeLoad = null;
const loadType = () =>
  (typeLoad ??= new Promise((done) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = LOOKS_CSS;
    l.onload = l.onerror = done;
    document.head.append(l);
  }));
let look = 'water',
  top = 'water',
  base = 'water',
  inkOn = false,
  lookTimer = 0,
  // the language is the visitor's own choice, apart from the look: remembered, else the browser's
  // (English, Chinese or Japanese); zhOn means the words come from a dictionary (ZH, or JA) rather than the markup
  lang = (() => {
    const l = (load('pond-lang') ?? (navigator.languages || [navigator.language]).find((x) => /^(zh|en|ja)/i.test(x)) ?? 'en').toLowerCase().slice(0, 2);
    return l === 'zh' || l === 'ja' ? l : 'en';
  })(),
  zhOn = lang !== 'en',
  langTimer = 0,
  inkR = 0,
  inkMax = 1,
  inkO = [0, 0],
  timeScale = 1,
  simAcc = 0,
  inkAt = -9,
  blots = [];
const blotU = new Float32Array(30),
  lerpN = (a, b, t) => a + (b - a) * t;
// The words on the page, in English as the markup has them, and in Chinese from ZH.
const HOME = {
  say: $('.say').innerHTML,
  toc: [...document.querySelectorAll('.toc .go b')].map((b) => b.textContent),
  long: $('#cmdBtn .long').textContent,
  short: $('#cmdBtn .short').textContent,
  talk: $('#talk > span:last-child').textContent
};
function speak() {
  pond.lang = lang;
  $('#termV').lang = lang === 'ja' ? 'ja' : 'zh';
  $('.say').innerHTML = zhOn ? `${esc(ZH.say)} <button class="tlink" data-sheet="about">${esc(ZH.more)}</button>` : HOME.say;
  document.querySelectorAll('.toc .go b').forEach((b, i) => (b.textContent = zhOn ? ZH.toc[i] : HOME.toc[i]));
  $('#cmdBtn .long').textContent = zhOn ? ZH.search[0] : HOME.long;
  $('#cmdBtn .short').textContent = zhOn ? ZH.search[1] : HOME.short;
  $('#palIn').placeholder = zhOn ? ZH.search[0] : 'Search the pond, or type / for commands';
  $('#talk > span:last-child').textContent = zhOn ? ZH.talk : HOME.talk;
  $('#hero').textContent = salute()[0];
  showTerm();
  tick();
  fillNotes();
  sealsEntry();
  if (sheetOpen() && sheetId) openSheet(sheetId);
}
// En / 中 / 日: the page's words fade, turn to the other language and come back; the look is left as it is.
const LANGS = ['en', 'zh', 'ja'];
const nextLang = () => LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
function setLang(to) {
  if (to === lang || !LANGS.includes(to)) return;
  lang = to;
  zhOn = to !== 'en';
  ZH = to === 'ja' ? D.ja : D.zh;
  if (to === 'ja') loadType();
  save('pond-lang', to);
  langBtn();
  pond.dataset.speaking = '';
  clearTimeout(langTimer);
  langTimer = setTimeout(
    () => {
      speak();
      delete pond.dataset.speaking;
    },
    RM ? 0 : 260
  );
}
const LANG_NAME = { en: ['En', 'English'], zh: ['中', '中文'], ja: ['日', '日本語'] };
// three languages, each its own segment, the one in use lit
function langBtn() {
  const seg = $('#langBtn');
  for (const x of seg.querySelectorAll('[data-lang]')) x.setAttribute('aria-pressed', String(x.dataset.lang === lang));
  seg.style.setProperty('--i', LANGS.indexOf(lang));
}
// Each label's ink, measured, set on the centre of its cell: line boxes centre the em box, not the glyph,
// and 'En' in the sans and 中/日 in the brush each sit off it differently. Run once the faces have come.
function alignSeg() {
  alignInk('#langBtn button span');
  alignInk('.kuan .seal span');
  alignInk('#kuanTxt span');
}
function alignInk(sel) {
  const c = document.createElement('canvas').getContext('2d');
  for (const s of document.querySelectorAll(sel)) {
    const st = getComputedStyle(s),
      size = parseFloat(st.fontSize);
    c.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    const m = c.measureText(s.textContent),
      A = m.fontBoundingBoxAscent,
      D = m.fontBoundingBoxDescent,
      base = (size - (A + D)) / 2 + A, // where the baseline sits in a line box of line-height 1
      dy = size / 2 - (base + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2),
      dx = m.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    s.style.setProperty('--dx', `${dx.toFixed(2)}px`);
    s.style.setProperty('--dy', `${dy.toFixed(2)}px`);
  }
}
// A look may put the page's blocks elsewhere (青花's rim insets them, the Dunhuang wall's bands lift the clock
// and the controls, each face sets the title a little differently). They glide from where they stood to
// where the look puts them, as they come back into view: measured before and after the change, then eased
// from the old place by a transform laid over whatever transform they have. Under reduced motion they just change.
const GLIDES = ['#lead', '.alm', '.hud .bl', '.hud .cmd', '.hud .br', '.gauge', '.preview'];
function glide(change) {
  const els = RM ? [] : GLIDES.map((q) => $(q)).filter((el) => el && el.animate),
    was = els.map((el) => el.getBoundingClientRect());
  change();
  let moved = false;
  els.forEach((el, i) => {
    const a = was[i],
      b = el.getBoundingClientRect();
    if (!a.width || !b.width) return;
    // by the corner the block hangs from: whichever side of the pond it is nearer
    const dx = a.left + a.width / 2 < W / 2 ? a.left - b.left : a.right - b.right,
      dy = a.top + a.height / 2 < H / 2 ? a.top - b.top : a.bottom - b.bottom;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    moved = true;
    el.animate([{ transform: `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px)` }, { transform: 'translate(0,0)' }], {
      duration: GLIDE_MS,
      easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
      composite: 'add'
    });
  });
  // the glass under a gliding control is drawn where the control is, all the way
  if (moved) panesFor(GLIDE_MS + 80);
}
const GLIDE_MS = 640;
const setInk = (on, from) => setLook(on ? 'ink' : 'water', from || $('#inkBtn'));
function setLook(name, from) {
  if (!LOOKS.includes(name) || name === look) return;
  if (name in PICTURED) {
    picLook = name;
    PICTURED[name]();
    paintPic();
  }
  loadKoi(name);
  if (name !== 'water' && name !== 'ink') loadType();
  const was = look;
  look = name;
  // (the pads are painted ones in Monet's pond, and none lie under ink's painting)
  setTimeout(padsNow, 0);
  inkOn = name === 'ink';
  inkAt = performance.now() / 1000;
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.clearRect(0, 0, air.width, air.height);
  blots = [];
  if (name === 'water') {
    // back to the water: the look on show draws in to where it was asked from
    if (top === 'water') top = was;
    base = 'water';
  } else {
    // over what shows now: the last look if it had come in fully, else what was under it
    base = top === 'water' || inkR >= inkMax * 0.999 ? top : base;
    top = name;
    inkR = 0;
  }
  // from a control, or from a place on the water (a gesture)
  if (Array.isArray(from)) inkO = from.slice();
  else {
    const r = (from || $('#termV')).getBoundingClientRect(),
      pr = pond.getBoundingClientRect();
    inkO = [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2];
  }
  const far = Math.hypot(Math.max(inkO[0], W - inkO[0]), Math.max(inkO[1], H - inkO[1])) + 220;
  inkMax = top === 'blueprint' ? H + 40 : top === 'ukiyo' ? (W + H) * 0.7072 + 40 : far;
  if (name === 'water' && inkR > inkMax) inkR = inkMax;
  pond.dataset.inking = '';
  $('#inkBtn').setAttribute('aria-pressed', String(inkOn));
  clearTimeout(lookTimer);
  lookTimer = setTimeout(
    () =>
      glide(() => {
        pond.toggleAttribute('data-ink', inkOn);
        if (name === 'water') delete pond.dataset.look;
        else pond.dataset.look = name;
        // (the pads are the look's own picture of them, where it has one)
        padsNow();
        speak();
        if (inkOn) {
          paintInk();
          placeKuan();
          alignSeg();
        }
        delete pond.dataset.inking;
      }),
    name === 'water' ? 900 : 700
  );
  audio();
  if (name === 'water') return;
  drop(inkO[0], inkO[1], { ink: 7, blueprint: 1.6 }[name] || 4, -3.2);
  plip(`look-${name}`);
}
// ASCII's characters, drawn once into a strip the glass pass reads by brightness: blank to dense.
const RAMP = ' .:-=+*#%@',
  CELL = [9, 17];
let atlasOn = false;
function atlas() {
  if (atlasOn) return;
  atlasOn = true;
  const draw = () => {
    const S = 3,
      cv = document.createElement('canvas'),
      c = cv.getContext('2d');
    cv.width = CELL[0] * S * RAMP.length;
    cv.height = CELL[1] * S;
    c.fillStyle = '#fff';
    c.font = `500 ${Math.round(CELL[1] * S * 0.8)}px 'JetBrains Mono', ui-monospace, monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    [...RAMP].forEach((ch, i) => c.fillText(ch, (i + 0.5) * CELL[0] * S, CELL[1] * S * 0.54));
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
  };
  draw();
  // drawn again once the face has come (it loads with the looks' type)
  loadType()
    .then(() => document.fonts?.load(`500 40px 'JetBrains Mono'`))
    .then(draw, () => {});
}
// The inscription and the seal hang on the solar term's own axis, centred under its characters.
function placeKuan() {
  const k = $('.kuan');
  if (!inkOn || !k) return;
  sealsPic();
  const a = $('.alm').getBoundingClientRect(),
    t = $('#termV').getBoundingClientRect(),
    // a brushed character's ink sits off the middle of its box: the axis is the ink's, for both columns
    off = (el) => {
      const st = getComputedStyle(el),
        c = document.createElement('canvas').getContext('2d');
      c.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const chars = [...el.textContent].filter((ch) => ch.trim());
      return (
        chars.reduce((sum, ch) => {
          const m = c.measureText(ch);
          return sum + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.width / 2;
        }, 0) / (chars.length || 1)
      );
    },
    axis = t.left + t.width / 2 + off($('#termV'));
  k.style.right = `${(a.right - axis - k.offsetWidth / 2).toFixed(2)}px`;
}
// Ink as a hanging painting: the season's motif (painting.js, loaded the first time ink comes) washes in
// at one edge; a new season washes the old one out and the new one in, with a brush's breath.
let painted = '';
const inkSeason = () => paintingOf(seasonOf(yearGoal, south ? -1 : 1));
function paintInk() {
  if (!inkOn) return;
  const season = inkSeason(),
    key = `${season} ${Math.round(W)} ${Math.round(H)}`;
  if (key === painted) return;
  const first = !painted;
  painted = key;
  const cv = $('#inkArt');
  delete cv.dataset.on;
  import('./painting.js').then(({ paint }) =>
    setTimeout(
      () =>
        paint(cv, W, H, season).then(() => {
          cv.dataset.on = '';
          if (!first) plip('cue-ink', 0.8);
        }),
      first ? 0 : 900
    )
  );
}
// The front runs out fast and then slows, as ink does in wet paper; time all but stops as the drop lands
// and comes back slow; going back, the look draws in to where it came from and time runs up again.
// The print is peeled off from the top left, the blueprint scanned from the top; the text spreads as a drop does.
function stepInk(raw) {
  const k = performance.now() / 1000 - inkAt;
  if (look !== 'water') {
    if (top === 'blueprint') inkR = inkMax * Math.min(1, k / 1.5);
    else inkR = inkMax * (1 - Math.exp(-k * ({ ink: 1.25, ukiyo: 1.1, glow: 1.6, ascii: 1.4 }[top] || 1.6))) * Math.min(1, 0.2 + k * 3);
    if (k > 4.5) inkR = inkMax;
    if (inkR >= inkMax && base !== top) {
      base = top;
      reached(top);
    }
  } else if (inkR > 0) {
    inkR = Math.max(0, inkR - raw * inkMax * (0.4 + k * 1.3));
    if (inkR <= 0) top = 'water';
  }
  const goal = inkOn ? (k < 0.5 ? 0.06 : 0.32) : look === 'glow' ? 0.7 : top === 'ink' && inkR > 0 ? 0.25 : 1;
  timeScale += (goal - timeScale) * Math.min(1, raw * (inkOn && k < 0.5 ? 9 : 1.6));
}
let calmNow = 1;
function drawSpider(c) {
  if (!life || spider.alpha < 0.02 || spider.pad < 0 || !spider.feet.length) return;
  const u = spiderSize() * 0.46,
    up = spider.state === 'jump' ? Math.sin(spider.jump * Math.PI) : 0,
    half = life.SPIDER * u * (1 + up * 0.3);
  c.globalAlpha = spider.alpha;
  drawCell(c, 'spider', spiderFrame(spider), spider.x, spider.y, spider.a, half, spider.state === 'jump' ? 0 : 0.9);
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
// with ?perf, for the tools that picture the pond (tools/pond/): where the two are and what they are doing,
// and a way to show visitors who are not there (it changes this browser's picture only)
if (PERF) window.__pond = { dove, spider, visitors: (list) => seeVisitors(list) };
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
        dove.t = 0;
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
    q.x += dt * 0.012 * (pv.windX / 13);
    q.y += dt * 0.02 * (pv.windY / 6);
    if (q.z <= 0) {
      q.z = 1;
      q.x = Math.random();
      q.y = Math.random();
    }
  }
}
// The dove is laid into the air over the pond, larger the higher it flies.
function drawDove(c) {
  if (!life || dove.state === 'away') return;
  const u = doveSize() * 0.34 * (1 + dove.h * 0.28),
    half = life.DOVE * u;
  count('dove');
  drawCell(
    c,
    'dove',
    doveFrame({ state: dove.state, t: dove.t, h: dove.h, ph: dove.ph, idle: dove.sips >= 4 }),
    dove.x,
    dove.y,
    dove.a,
    half,
    1 - clamp(dove.h * 4, 0, 1)
  );
}
// how the look lays the two into the air: ink soaks into the paper, glow adds light; the rest as they are
const LAY = { ink: ['multiply', 0.8], glow: ['lighter', 0.65], ascii: ['source-over', 0.6], ...NEW_LAY };
function laidIn(c, draw) {
  const l = LAY[look];
  if (!l) return draw();
  c.save();
  c.globalCompositeOperation = l[0];
  c.globalAlpha = l[1];
  draw();
  c.restore();
}
let dimsAt = 0,
  typeEdge = -1;
// Blueprint: each koi measured along its back, each press a radius, in a draughtsman's hand.
function drawDims(c) {
  // not over the title page's type: the measures keep to the open water
  if (!(dimsAt++ % 30)) {
    const r = $('#toc').getBoundingClientRect();
    typeEdge = r.width && r.right < W * 0.8 ? r.right + 30 : -1;
  }
  c.save();
  c.strokeStyle = 'rgba(225,240,255,0.75)';
  c.fillStyle = 'rgba(225,240,255,0.9)';
  c.lineWidth = 1;
  c.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
  for (const k of kois) {
    if (k.alpha < 0.5 || underGlass(k.x, k.y) || (k.x < typeEdge && !sheetOpen())) continue;
    const h = k.spine[0],
      t = k.spine[N - 1],
      a = Math.atan2(t.y - h.y, t.x - h.x),
      nx = -Math.sin(a) * 22,
      ny = Math.cos(a) * 22,
      A = [h.x + nx, h.y + ny],
      B = [t.x + nx, t.y + ny];
    c.beginPath();
    c.moveTo(h.x + nx * 0.3, h.y + ny * 0.3);
    c.lineTo(A[0] + nx * 0.2, A[1] + ny * 0.2);
    c.moveTo(t.x + nx * 0.3, t.y + ny * 0.3);
    c.lineTo(B[0] + nx * 0.2, B[1] + ny * 0.2);
    c.moveTo(A[0], A[1]);
    c.lineTo(B[0], B[1]);
    c.stroke();
    for (const [P, d] of [
      [A, 1],
      [B, -1]
    ]) {
      c.beginPath();
      c.moveTo(P[0], P[1]);
      c.lineTo(P[0] + Math.cos(a + 0.35) * 7 * d, P[1] + Math.sin(a + 0.35) * 7 * d);
      c.moveTo(P[0], P[1]);
      c.lineTo(P[0] + Math.cos(a - 0.35) * 7 * d, P[1] + Math.sin(a - 0.35) * 7 * d);
      c.stroke();
    }
    c.save();
    c.translate((A[0] + B[0]) / 2 + nx * 0.5, (A[1] + B[1]) / 2 + ny * 0.5);
    c.rotate(Math.cos(a) < 0 ? a + Math.PI : a);
    c.textAlign = 'center';
    c.fillText(`L ${(k.size / 100).toFixed(2)} m · v ${(k.sp / 100).toFixed(2)} m/s`, 0, 4);
    c.restore();
  }
  for (const b of blots) {
    const t = wall() - b.at,
      R = 12 + 50 * Math.sqrt(t);
    if (t > 20) continue;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x + R * 0.7071, b.y - R * 0.7071);
    c.stroke();
    c.fillText(`R ${(R / 100).toFixed(2)}`, b.x + R * 0.7071 + 4, b.y - R * 0.7071 - 4);
  }
  // the two visitors, labelled as a drawing labels its parts
  c.textAlign = 'left';
  if (life && dove.state !== 'away') c.fillText('Devot · dove', dove.x + 26, dove.y + 30);
  if (life && spider.alpha > 0.6 && spider.pad >= 0) c.fillText('ocra · jumping spider', spider.x + 22, spider.y + 26);
  c.restore();
}
// Rain falls where a look can carry it: on the water, in ink (fine dry strokes, and soft blooms where it
// lands), in the print (Hiroshige's straight lines) and in ASCII (falling | and /). Glow and blueprint
// hold it off: the drops stop and the ripples settle, and it comes back with the water.
// presses, splashes and blooms keep the clock on the wall, not the frames: a slow frame never stretches them
const wall = () => performance.now() / 1000;
const RAINY = { water: 1, ink: 1, ukiyo: 1, ascii: 1 },
  blooms = [],
  rainNow = () => raining && RAINY[look] === 1,
  // on the star chart rain is a shower of meteors: nothing falls on the water, the sky does it
  meteorsNow = () => raining && look === 'stars' && inkR >= inkMax * 0.9,
  meteors = [];
let meteorAt = 0;
function drawMeteors(c) {
  const now = wall();
  if (now > meteorAt) {
    meteorAt = now + rnd(0.12, 0.5);
    const a = 2.25 + rnd(-0.12, 0.12);
    meteors.push({ x: rnd(0.1, 1.25) * W, y: rnd(-0.1, 0.6) * H, a, v: rnd(520, 900), len: rnd(70, 190), at: now, life: rnd(0.45, 0.9) });
  }
  c.save();
  c.lineCap = 'round';
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i],
      k = (now - m.at) / m.life;
    if (k >= 1) {
      meteors.splice(i, 1);
      continue;
    }
    // a head that runs down the sky and a tail that thins out behind it; bright in the middle of its life
    const d = (now - m.at) * m.v,
      hx = m.x + Math.cos(m.a) * d,
      hy = m.y + Math.sin(m.a) * d,
      tx = hx - Math.cos(m.a) * m.len,
      ty = hy - Math.sin(m.a) * m.len,
      o = Math.sin(k * Math.PI),
      g = c.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, `rgba(240,246,255,${0.9 * o})`);
    g.addColorStop(0.3, `rgba(190,208,250,${0.4 * o})`);
    g.addColorStop(1, 'rgba(170,190,240,0)');
    c.strokeStyle = g;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(tx, ty);
    c.stroke();
    c.fillStyle = `rgba(255,255,255,${o})`;
    c.beginPath();
    c.arc(hx, hy, 1.5, 0, TAU);
    c.fill();
  }
  c.restore();
}
// the rain itself, drawn in the air in the look's own hand, once the look has come in
function drawRain(c) {
  if (meteorsNow()) return drawMeteors(c);
  if (!rainNow() || look === 'water' || inkR < inkMax * 0.9 || AM.ice > 0.3) return;
  c.save();
  if (look === 'ink') {
    for (const b of blooms) {
      const a = wall() - b.at,
        r = b.r * (1 + Math.min(a, 3) * 0.6),
        o = 0.13 * Math.max(0, 1 - a / 5);
      if (o <= 0) continue;
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, `rgba(40,36,32,${o})`);
      g.addColorStop(0.75, `rgba(40,36,32,${o * 0.6})`);
      g.addColorStop(1, 'rgba(40,36,32,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(b.x, b.y, r, 0, TAU);
      c.fill();
    }
    c.strokeStyle = 'rgba(30,27,24,0.2)';
    c.lineCap = 'round';
    for (let i = 0; i < (big ? 46 : 20); i++) {
      const x = rnd(-40, W),
        y = rnd(-40, H),
        l = rnd(18, 46);
      c.lineWidth = rnd(0.6, 1.4);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + l * 0.26 * (pv.windX / 13), y + l);
      c.stroke();
    }
  } else if (look === 'ukiyo') {
    c.strokeStyle = 'rgba(12,26,52,0.42)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < (big ? 140 : 60); i++) {
      const x = rnd(-80, W),
        y = rnd(-H * 0.3, H),
        l = rnd(H * 0.12, H * 0.32);
      c.moveTo(x, y);
      c.lineTo(x + l * 0.09 * (pv.windX / 13), y + l);
    }
    c.stroke();
  } else if (look === 'ascii') {
    c.fillStyle = 'rgba(150,200,205,0.5)';
    c.font = "500 14px 'JetBrains Mono', ui-monospace, monospace";
    c.textAlign = 'center';
    for (let i = 0; i < (big ? 70 : 30); i++)
      c.fillText(Math.random() < 0.7 ? '|' : '/', Math.floor(rnd(0, W) / CELL[0]) * CELL[0], Math.floor(rnd(0, H) / CELL[1]) * CELL[1]);
  }
  c.restore();
}
// Summer nights: a handful of soft lights that drift and blink; a press near them sends them off.
const fireflies = () => pv.fliesOn || (AM.flies > 0.3 && phase === 'night' && look !== 'blueprint');
function drawFireflies(c) {
  if (NEW_WITHOUT[look]?.flies) return;
  if (!fireflies()) return (pv.flies.length = 0);
  if (!pv.flies.length) pv.flies = Array.from({ length: big ? 9 : 5 }, () => ({ x: rnd(0.45, 0.95) * W, y: rnd(0.1, 0.9) * H, vx: 0, vy: 0, p: rnd(0, TAU) }));
  const now = performance.now() / 1000;
  for (const q of pv.flies) {
    q.vx += (Math.sin(now * 0.7 + q.p) * 6 - q.vx * 0.6) * lifeRaw;
    q.vy += (Math.cos(now * 0.55 + q.p * 1.3) * 6 - q.vy * 0.6) * lifeRaw;
    q.x = clamp(q.x + q.vx * lifeRaw, 10, W - 10);
    q.y = clamp(q.y + q.vy * lifeRaw, 10, H - 10);
    const a = Math.max(0, Math.sin(now * 1.3 + q.p * 5)) ** 2;
    if (a < 0.03) continue;
    const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, 13);
    g.addColorStop(0, `rgba(240,255,180,${a})`);
    g.addColorStop(0.25, `rgba(220,255,150,${0.6 * a})`);
    g.addColorStop(1, 'rgba(200,255,140,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(q.x, q.y, 13, 0, TAU);
    c.fill();
  }
}
// Whether anything is in the air this frame; when nothing is, the canvas is cleared once and hidden.
let airShown = true;
const airWanted = () =>
  (look === 'blueprint' && inkR >= inkMax * 0.9) ||
  (look !== 'water' && rainNow()) ||
  meteorsNow() ||
  gest.down ||
  gest.letters.length > 0 ||
  (gest.taps && gest.taps.length > 0) ||
  gest.glint > 0.05 ||
  AM.snow > 0.02 ||
  fx.snow > 0.02 ||
  (rainNow() && AM.ice > 0.3) ||
  flies.some((f) => f.a2 >= 0.02) ||
  fireflies() ||
  (life && dove.state !== 'away');
function drawAir() {
  const c = actx;
  stepGesture();
  if (!airWanted()) {
    if (airShown) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, air.width, air.height);
      air.style.visibility = 'hidden';
      airShown = false;
    }
    return;
  }
  if (!airShown) {
    air.style.visibility = '';
    airShown = true;
  }
  c.setTransform(adpr, 0, 0, adpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (look === 'blueprint' && inkR >= inkMax * 0.9) drawDims(c);
  drawRain(c);
  drawFireflies(c);
  drawGesture(c);
  if (Math.max(AM.snow, fx.snow) > 0.02 || (rainNow() && AM.ice > 0.3)) {
    const n = Math.max(AM.snow, fx.snow, rainNow() && AM.ice > 0.3 ? 0.7 : 0);
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
    // (a look that has no place for a dragonfly does without: the night sky, glaze, a painted or carved wall)
    if (f.a2 < 0.02 || NEW_WITHOUT[look]?.flies) continue;
    c.save();
    c.globalAlpha = f.a2 * (look === 'monet' ? 0.42 : 1);
    c.translate(f.x, f.y);
    c.rotate(f.a);
    // the look's own flyer: a sheet of wing frames, or a cell of what drifts and flies
    const wing = artOf('fly'),
      flyer = wing ? null : artOf('afloat');
    if (wing) {
      const i = flies.indexOf(f),
        k = wing.beat ? Math.floor(T * wing.beat + i * 1.7) % wing.frames : i % wing.frames;
      c.globalAlpha = f.a2;
      c.drawImage(wing.pic, k * 256, 0, 256, 256, -30, -30, 60, 60);
      c.restore();
      continue;
    }
    if (flyer?.fly) {
      c.globalAlpha = f.a2;
      cellAt(c, flyer.pic, flyer.fly[flies.indexOf(f) % flyer.fly.length], 50);
      c.restore();
      continue;
    }
    // (a look whose manner has no drawn dragonfly, and whose own flyer hasn't come, goes without)
    if (LOOK_ART[look]?.afloat?.fly) {
      c.restore();
      continue;
    }
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

// The shade of a tree over the pond: boughs of leaves drawn once and blurred once into a texture; the
// glass pass multiplies the pond by it, swaying as the CSS shade did (`.shade i + i`, the bough on top:
// it was opaque, so it was the one seen). Without WebGL the CSS shade still shows.
let shadeCv = null;
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
    if (n) shadeCv = cv;
    if (!glOK) el.style.backgroundImage = `url(${cv.toDataURL()})`;
  });
  shadeTex();
}
// the bough blurred as the CSS blur did (13 px on the page), into the shade texture
function shadeTex() {
  if (!glOK || !shadeCv) return;
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 400;
  const x = cv.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 640, 400);
  x.filter = `blur(${((13 * 640) / (W * 1.24)).toFixed(2)}px)`;
  x.drawImage(shadeCv, 0, 0);
  gl.activeTexture(gl.TEXTURE8);
  gl.bindTexture(gl.TEXTURE_2D, texShade);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.activeTexture(gl.TEXTURE0);
}
// The sway, as the CSS keyframes had it: 27 s each way, eased, from one pose to the other; and the
// shade's strength, eased over 2.5 s as its opacity was, by the time of day and the look.
let shadeK = 0.9;
function shadeUniforms(dt) {
  const goal = look in NEW_SHADE ? NEW_SHADE[look] : 'bare' in pond.dataset ? 0.25 : inkOn ? 0.35 : ({ night: 0.3, dawn: 0.6, dusk: 0.6 }[phase] ?? 0.9);
  // (a look with no shade at all loses it quickly, as its front passes)
  const quick = NEW_SHADE[look] === 0 ? 0.35 : 2.5;
  shadeK += clamp(goal - shadeK, -dt / quick, dt / quick);
  let u = RM ? -1 : (performance.now() / 27000) % 2;
  u = u < 0 ? 0 : u > 1 ? 2 - u : u;
  u = 1 - u; // alternate-reverse: it starts at the far pose
  const e = u * u * (3 - 2 * u),
    tx = lerpN(-0.013, 0.015, e) * W * 1.24,
    ty = lerpN(-0.008, 0.01, e) * H * 1.24,
    r = (lerpN(-0.7, 0.8, e) * Math.PI) / 180,
    sc = lerpN(1.02, 1.06, e),
    ok = RM ? [0, 0, 0, 1] : [tx, ty, r, sc],
    [ax, ay, ar, as] = ok,
    c = Math.cos(-ar) / as,
    sn = Math.sin(-ar) / as,
    cx = W / 2 + ax,
    cy = H / 2 + ay,
    w = W * 1.24,
    h = H * 1.24,
    ox = -0.12 * W,
    oy = -0.12 * H;
  // screen point → the bough's own frame (undo translate, rotate, scale about the centre) → its texture
  gl.uniform3f(UG.uSh0, c / w, -sn / w, (W / 2 - c * cx + sn * cy - ox) / w);
  gl.uniform3f(UG.uSh1, sn / h, c / h, (H / 2 - sn * cx - c * cy - oy) / h);
  gl.uniform1f(UG.uShK, shadeK);
  gl.uniform1i(UG.uShade, 8);
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
// The pond speaks English, Chinese or Japanese, chosen with En / 中 / 日 (content.ts, ZH and JA): L(en, zh) picks the words for now.
let ZH = lang === 'ja' ? D.ja : D.zh;
const L = (en, zh) => (zhOn ? zh : en);
const CN_MONTH = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const zhWhen = (w) => w.replace(/([A-Z][a-z]{2}) (\d{4})/g, (_, m, y) => (lang === 'ja' ? `${y}年${CN_MONTH[m]}月` : `${y}.${CN_MONTH[m]}`));
// an entry of the timeline as it reads now: in Chinese, what ZH gives for it over the English
const tr = (e) => {
  if (!zhOn) return e;
  const z = ZH.log[e.id] || {};
  return { ...e, ...z, when: zhWhen(e.when), ref: e.ref && z.ref ? [e.ref[0], z.ref] : e.ref };
};
function fillPanes() {
  // the timeline's and the photos' rows say only how many; their marks and pictures wait inside
  $('#tocWorkN').textContent = LOG.length;
  $('#photoMore').textContent = PHOTOS.length;
  fillNotes();
  fillMusic();
}
function fillNotes() {
  $('#noteLast').textContent = NOTES.length ? NOTES[0].body : L('Leave the first line', ZH.firstLine);
  $('#noteCount').textContent = NOTES.length || '';
  const all = $('#noteAll');
  if (all) all.innerHTML = notesHtml();
}
const notesHtml = () =>
  NOTES.map((n) => `<li><q>${esc(n.body)}</q><em>${esc(n.name)}, ${esc(ago(n.created_at))}</em></li>`).join('') ||
  `<li class="empty">${L('No boats yet.', ZH.notes.empty)}</li>`;
function ago(iso) {
  const m = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
  if (lang === 'ja')
    return m < 1
      ? 'たった今'
      : m < 60
        ? `${Math.round(m)} 分前`
        : m < 1440
          ? `${Math.round(m / 60)} 時間前`
          : `${new Date(iso).getMonth() + 1}月${new Date(iso).getDate()}日`;
  if (zhOn)
    return m < 1
      ? '刚刚'
      : m < 60
        ? `${Math.round(m)} 分钟前`
        : m < 1440
          ? `${Math.round(m / 60)} 小时前`
          : `${new Date(iso).getMonth() + 1}月${new Date(iso).getDate()}日`;
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
const entry = (en) => {
  const e = tr(en);
  return `<li id="p-${e.id}" data-kind="${e.kind}" data-depth="${depthOf(e)}" data-year="${Math.floor(e.s)}"><span class="depth"><b>${Math.floor(e.s)}</b>${depthOf(e)} m</span>${e.mark ? `<i class="node mark${e.kind === 'project' ? ' full' : ''}" style="--bg:${e.mark === 'tiktok' ? '#000' : '#fff'}"><img src="${markSrc(e.mark)}" alt=""></i>` : `<i class="node" style="--c:${e.c || 'none'}"></i>`}
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
  ${e.source ? `<div class="links">${e.visit ? `<a class="link" href="${e.visit}" target="_blank" rel="noopener">${L('Visit', ZH.career.visit)} ↗</a>` : ''}<a class="link" href="${e.source}" target="_blank" rel="noopener">${L('Source', ZH.career.source)} ↗</a></div>` : ''}</li>`;
};
const monthOf = (p) =>
  zhOn
    ? `${new Date(p.taken).getFullYear()}年${new Date(p.taken).getMonth() + 1}月`
    : new Date(p.taken).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const KINDS = [
  ['all', 'All'],
  ['role', 'Roles'],
  ['project', 'Projects'],
  ['school', 'School']
];
let logKind = 'all',
  logCompact = false;
const SHEETS = {
  seals: () => `<div class="album">${albumHTML(album, VOLS, lang, freshVols())}</div>`,
  career:
    () => `<h1>${L('Soundings', ZH.career.title)}</h1><p class="lede">${L("Work, projects and school on one line, newest at the surface. Scroll, and the pond's focus sinks with you to the bed.", ZH.career.lede)}</p>
    <div class="filt" role="toolbar" aria-label="Show">${KINDS.map(([k, l]) => `<button data-kind="${k}">${L(l, ZH.career.kinds[k])}<em>${k === 'all' ? LOG.length : LOG.filter((e) => e.kind === k).length}</em></button>`).join('')}<span class="gap"></span>
      <button data-view="detail" aria-label="In full"><svg width="14" height="14" viewBox="0 0 14 14" stroke-width="1.3" stroke-linecap="round"><rect x="1.5" y="2" width="4" height="4" rx="1"/><path d="M8 3h4.5M8 5h3M1.5 9.5h11M1.5 12h8"/></svg></button>
      <button data-view="list" aria-label="Titles only"><svg width="14" height="14" viewBox="0 0 14 14" stroke-width="1.3" stroke-linecap="round"><path d="M1.5 3h11M1.5 7h11M1.5 11h11"/></svg></button></div>
    <ol class="sound" id="sound">${LOG.map(entry).join('')}<li class="bed" data-kind="bed" data-depth="${depthOf(LOG[LOG.length - 1])}" data-year="${Math.floor(LOG[LOG.length - 1].s)}"><span class="depth">${L('bed', '池底')}</span><i class="node"></i><p class="role">${L('The bed. Everything above settled on this.', ZH.career.bed)}</p></li></ol>`,
  about:
    () => `<h1>${L("Hey, I'm Jincheng.", ZH.about.title)}</h1><div class="prose">${(zhOn ? ZH.about.paragraphs : D.about).map((p) => `<p>${chips(p)}</p>`).join('')}
    <div class="links"><a class="link" href="https://github.com/jma49" target="_blank" rel="noopener">GitHub ↗</a><button class="link" data-sheet="career">${L('Timeline', ZH.toc[0])}</button><a class="link" href="/os">${L('The old desktop', ZH.about.desktop)}</a></div></div>
    <p class="fine" id="letterTime"></p>`,
  music: () => {
    const m = music(),
      song = m.songs[m.index];
    return `<h1>${L("What's on", ZH.music.title)}</h1><p class="lede">${L("Ryuichi Sakamoto, mostly at the piano: what I put on when it's quiet. The pond's sound switch turns him down too.", ZH.music.lede)}</p>
    ${song ? `<div class="now-song"><img id="nowCover" src="${coverOf(song)}" alt=""><div><b id="nowTitle">${esc(song.title)}</b><span id="nowWho">${esc(song.artist)}</span></div></div>` : ''}
    <ul class="rows songs" id="songList">${m.songs.map((t, i) => `<li data-i="${i}" ${i === m.index ? 'data-now' : ''}><button data-song="${i}" aria-label="Play ${esc(t.title)}">${PLAY}</button><b>${esc(t.title)}</b><span class="who">${esc(t.artist)}</span></li>`).join('') || `<li class="empty">${L('The songs are on their way.', ZH.music.empty)}</li>`}</ul>`;
  },
  photos:
    () => `<h1>${L(`${PHOTOS.length} photographs`, ZH.photos.title.replace('{n}', PHOTOS.length))}</h1><p class="lede">${L('Newest first, from', ZH.photos.lede)} <a href="${D.unsplash}" target="_blank" rel="noopener">Unsplash</a>${L('. Press one to see it large; the arrow keys move through them.', ZH.photos.after)}</p>
    <div class="shots just">${PHOTOS.map((p, i) => `<a href="${p.page}" data-i="${i}" style="--ar:${(p.w / p.h).toFixed(3)};background:${p.color}" aria-label="Photograph, ${monthOf(p)}"><img src="${p.thumb}" alt="${esc(p.alt)}" loading="lazy"><span>${monthOf(p)}</span></a>`).join('')}</div>`,
  notes:
    () => `<h1>${L('Paper boats', ZH.notes.title)}</h1><p class="lede">${L('The guestbook. Leave a line, a few a day; it sails off across the pond as a boat, and whoever comes by can read it.', ZH.notes.lede)}</p>
    ${noteForm()}<ul class="notes" id="noteAll">${notesHtml()}</ul>`,
  chat: () => `<h1>${L('Chat', ZH.chat.title)}</h1><p class="lede" id="chatWho"></p><div class="rooms" id="rooms" role="tablist" aria-label="Rooms"></div>
    <ol class="chat" id="chatLog" aria-live="polite"></ol>
    ${me ? `<form class="noteform chatform"><input maxlength="500" placeholder="${L('Say something to the room', ZH.chat.placeholder)}" autocomplete="off" aria-label="Your message"><button aria-label="Send"><svg width="15" height="15" viewBox="0 0 16 16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button></form>` : signInFirst(L('to talk', ZH.chat.why))}`,
  account: () =>
    me
      ? `<h1>${esc(me.username)}</h1><p class="lede">${L('Signed in. Your koi carries your name, and you can leave notes and talk in the chat.', ZH.account.signedIn)}</p><div class="links"><button class="link" data-act="signout">${L('Sign out', ZH.account.signOut)}</button></div>`
      : `<h1>${signingUp ? L('Make an account', ZH.account.signUp) : L('Sign in', ZH.account.signIn)}</h1><p class="lede">${signingUp ? L('A username and a password; the recovery address is optional.', ZH.account.ledeUp) : L('The same account as on the old desktop.', ZH.account.lede)}</p>
    <form class="acct" data-mode="${signingUp ? 'up' : 'in'}"><label>${L('Username', ZH.account.username)}<input name="u" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+"></label>
      <label>${L('Password', ZH.account.password)}<input name="p" type="password" autocomplete="${signingUp ? 'new-password' : 'current-password'}" required minlength="6"></label>
      ${signingUp ? `<label>${L('Recovery address', ZH.account.recovery)} <small>${L('(optional)', ZH.account.optional)}</small><input name="e" type="email" autocomplete="email"></label>` : ''}
      <p class="err" id="acctErr" role="alert"></p>
      <div class="links"><button class="link main">${signingUp ? L('Make the account', ZH.account.make) : L('Sign in', ZH.account.signIn)}</button><button type="button" class="link" data-act="switch">${signingUp ? L('I have an account', ZH.account.have) : L('Make an account', ZH.account.makeOne)}</button></div></form>`
};
const chips = (p) =>
  p
    .replace(/\{work:(\w+)\}/g, (_, id) => {
      const e = PROJECTS.find((x) => x.id === id);
      return e ? `<button class="chip mk" data-sheet="work" data-focus="${id}"><img src="${markSrc(e.mark)}" alt="">${esc(e.title)}</button>` : id;
    })
    .replace('{photos}', `<button class="chip" data-sheet="photos" style="--c:#6fb9cc">${L('photos', ZH.about.photos)}</button>`);
const signInFirst = (why) =>
  accountsOpen
    ? `<p class="signin"><button class="link main" data-sheet="account">${L('Sign in', ZH.account.signIn)}</button> <span>${why}${L('.', '。')}</span></p>`
    : `<p class="signin"><span>${L('Signing in isn’t open on this copy of the site.', ZH.account.closed)}</span></p>`;
const noteForm = () =>
  me
    ? `<form class="noteform"><input maxlength="280" placeholder="${L('Leave a line', ZH.notes.placeholder)}" autocomplete="off" aria-label="Your note"><button aria-label="Launch the note"><svg width="15" height="15" viewBox="0 0 16 16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button></form>`
    : signInFirst(L('to leave one', ZH.notes.why));
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
  account: ['', 'Account'],
  seals: ['', 'Seals']
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
  $('#readout').textContent = cur ? `↓ ${cur.dataset.depth} m · ${cur.dataset.year}` : `↓ 0.0 m · ${L('today', '今天')}`;
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
let sheetId = '';
function openSheet(id, at) {
  sheetId = id;
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
    `<header class="head"><p class="eyebrow">${id === 'seals' ? SEAL_WORDS[lang].title : L(name, ZH.chapters[id])}</p><span class="read" id="readout"></span><nav class="chap" aria-label="Chapters">${ORDER.map((k) => `<button data-sheet="${k}" aria-label="${L(CHAPTERS[k][1], ZH.chapters[k])}" ${CHAPTERS[k][0] === no ? 'aria-current="true"' : ''}>${+CHAPTERS[k][0]}</button>`).join('')}</nav><button class="x" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></header><div class="scroll" id="scroll">${SHEETS[log ? 'career' : id]()}</div>` +
    (id === 'photos'
      ? '<div class="view" id="view" hidden><button class="vx" aria-label="Close the photograph"><svg width="12" height="12" viewBox="0 0 12 12" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg></button><button class="vs" data-step="-1" aria-label="Previous">‹</button><img id="viewImg" alt="Photo by Jincheng Ma"><button class="vs" data-step="1" aria-label="Next">›</button><p><span id="viewCap"></span><a class="link" id="viewLink" target="_blank" rel="noopener">' +
        L('Open on Unsplash ↗', ZH.photos.open) +
        '</a></p></div>'
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
  else if (id === 'seals') albumShown();
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
  $('#chatWho').textContent = me
    ? L(`You're ${me.username}. Be kind; everyone here can read it.`, ZH.chat.you.replace('{u}', me.username))
    : L('Anyone can read along; members can talk.', ZH.chat.anyone);
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
      .join('') || `<li class="empty">${L('Nothing said here yet.', ZH.chat.empty)}</li>`;
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
$('#langBtn').addEventListener('click', (e) => {
  const seg = e.target.closest('[data-lang]');
  setLang(seg ? seg.dataset.lang : nextLang());
});
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
    ...PROJECTS.map(tr).map((p) => ({
      sec: 'Go to',
      mark: p.mark,
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
      hidden: true,
      cmd: true,
      run: () => setInk(!inkOn)
    },
    // the other looks: found only when searched for, never listed
    ...[
      ['ukiyo', '浮世絵 Ukiyo-e', 'A woodblock print; or stir the water once round', 'ukiyo ukiyo-e woodblock print hokusai wave japan 浮世絵'],
      ['glow', 'Glow', 'The lights go out; or press the light on the water', 'glow night neon dark light'],
      ['blueprint', 'Blueprint', 'A drawing on blue paper; or draw a long straight line', 'blueprint drawing plan draft ruler'],
      ['ascii', 'ASCII', 'The pond in characters; or type a few letters', 'ascii text characters terminal type'],
      ...NEW_COMMANDS
    ].map(([id, label, hint, kw]) => ({
      sec: 'Pond',
      icon: 'brush',
      label: look === id ? 'Back to the water' : label,
      hint,
      kw,
      hidden: true,
      cmd: true,
      run: () => setLook(look === id ? 'water' : id)
    })),
    {
      sec: 'Pond',
      icon: 'brush',
      label: LANG_NAME[nextLang()][1],
      hint: `The pond in ${{ en: 'English', zh: 'Chinese', ja: 'Japanese' }[nextLang()]}`,
      key: 'L',
      kw: 'language chinese english japanese 中文 语言 日本語 lang',
      cmd: true,
      run: () => setLang(nextLang())
    },
    // the weather where the visitor is, said plainly
    ...(wx
      ? [
          {
            sec: 'Pond',
            icon: 'rain',
            label: weatherLine(),
            hint: L('From Open-Meteo, for where you are', zhOn ? (lang === 'ja' ? 'Open-Meteo より、あなたのいる場所' : '来自 Open-Meteo，你所在的地方') : ''),
            kw: 'weather temperature rain where 天气 天気',
            run: () => {}
          }
        ]
      : []),
    // it rains only on the water: in a look the rain waits, and the command with it
    ...(look === 'water'
      ? [
          {
            sec: 'Pond',
            icon: 'rain',
            label: raining ? 'Stop the rain' : 'Make it rain',
            hint: 'Weather',
            kw: 'rain weather storm',
            cmd: true,
            run: () => {
              raining = !raining;
              rainChosen = true;
              tick();
            }
          }
        ]
      : []),
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
    // the seal album: listed once its mark shows, found by name before that; clearing it once a volume is full
    {
      sec: 'Pond',
      icon: 'brush',
      label: SEAL_WORDS[lang].open,
      hint: SEAL_WORDS[lang].openHint,
      kw: 'seals stamps album collection looks 集印册 集印帳 印 御朱印',
      hidden: !entryShows(album),
      cmd: true,
      run: () => openSheet('seals')
    },
    ...(VOLS.some((v) => full(album, v)) || PANEL
      ? [
          {
            sec: 'Pond',
            icon: 'again',
            label: SEAL_WORDS[lang].clear,
            hint: SEAL_WORDS[lang].clearHint,
            kw: 'seals clear reset again 清空 印 消す',
            hidden: !PANEL,
            cmd: true,
            run: () => setAlbum(clearSeals(album))
          }
        ]
      : []),
    ...(PANEL
      ? [
          {
            sec: 'Pond',
            icon: 'brush',
            label: 'Preview: stamp all seals',
            hint: 'Fills the album, a seal at a time',
            kw: 'preview seals stamp all',
            cmd: true,
            run: () => VOLS.flatMap((v) => v.seals).forEach((x, i) => setTimeout(() => reached(x.id), i * 3400))
          }
        ]
      : []),
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
      ? [['Commands', all.filter((c) => !c.hidden)]]
      : [
          ['Suggested', all.filter((c) => c.top)],
          ...['Go to', 'People', 'Music', 'Year', 'Pond'].map((s) => [s, all.filter((c) => c.sec === s && !c.top && !c.hidden)])
        ];
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
  `<li role="option" id="opt-${i}" data-i="${i}"><span class="ic">${c.mark ? `<img src="${markSrc(c.mark)}" alt="">` : c.dot ? `<i style="--c:${c.dot}"></i>` : ico(c.icon)}</span><span class="tx"><b>${label}</b><small>${esc(c.hint)}</small></span><span class="rt">${right ? (right.length <= 3 && right !== 'pond' ? `<kbd>${esc(right)}</kbd>` : esc(right)) : ''}</span></li>`;
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
  // "ascii" or "text" typed here is the same as typing on the page (a phone has no other keyboard)
  if (look !== 'ascii' && /^(ascii|text)$/i.test($('#palIn').value.trim())) {
    closePal();
    setLook('ascii', [W * (big ? 0.7 : 0.5), H * 0.6]);
    return;
  }
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
  else if (e.key === 'l' || e.key === 'L') setLang(nextLang());
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
// ---------- each look's sounds: its medium, quiet and short, all at about one loudness ----------
// ink: brush and paper; ukiyo-e: wood and koto; glow: a soft shimmer; blueprint: pencil and a ruler's click;
// ASCII: soft keys. What each does: a press, ice cracking, the look coming in, and a gesture's cue.
const KOTO = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46];
function tone(type, f, at, len, peak, f2, attack) {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + len * 0.6);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + (attack ?? Math.min(0.01, len * 0.2)));
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g);
  g.connect(sfx);
  o.start(at);
  o.stop(at + len + 0.05);
}
const brush = (t, dur, v) => hiss(t, dur, 1100, 0.7, v);
const wood = (t, v) => {
  tone('sine', rnd(760, 860), t, 0.06, v);
  hiss(t, 0.02, 1600, 4, v * 0.5);
};
const pluck = (t, f, v) => {
  tone('triangle', f, t, 0.9, v, null, 0.004);
  tone('sine', f * 2, t, 0.35, v * 0.35, null, 0.004);
};
const shimmer = (t, f, v, len = 1.1) => {
  for (const [m, k] of [
    [1, 1],
    [1.5, 0.5],
    [2.003, 0.35]
  ])
    tone('sine', f * m, t, len, v * k, null, 0.09);
};
const pencil = (t, dur, v) => hiss(t, dur, 5200, 1.4, v);
const ruler = (t, v) => {
  hiss(t, 0.008, 2400, 6, v);
  tone('sine', 190, t, 0.05, v * 0.6);
};
const key = (t, v) => {
  hiss(t, 0.01, rnd(2800, 3600), 5, v);
  tone('square', rnd(1700, 1900), t, 0.012, v * 0.12);
};
function lookSound(name, what, t, vol) {
  const v = 0.06 * vol,
    note = () => KOTO[(Math.random() * KOTO.length) | 0];
  if (name === 'ink') {
    if (what === 'in') {
      brush(t, 0.5, v * 0.35);
      bubble(t, rnd(180, 220), v * 1.1, 0.4);
    } else if (what === 'crack') {
      // a dry stroke snapping across the paper
      hiss(t, 0.09, 2200, 1.2, v);
      brush(t + 0.03, 0.18, v * 0.5);
    } else if (what === 'cue') brush(t, 0.35, v * 0.3);
    else {
      brush(t, 0.3, v * 0.3);
      bubble(t, rnd(190, 230), v * 0.8, 0.3);
    }
  } else if (name === 'ukiyo') {
    if (what === 'in') {
      wood(t, v);
      [0, 2, 4].forEach((n, i) => pluck(t + 0.08 + i * 0.11, KOTO[n + 1], v * 0.7));
    } else if (what === 'crack') {
      wood(t, v);
      wood(t + 0.07, v * 0.7);
      pluck(t + 0.02, KOTO[0], v * 0.5);
    } else if (what === 'cue') pluck(t, note(), v * 0.35);
    else {
      wood(t, v * 0.6);
      pluck(t + 0.01, note(), v * 0.55);
    }
  } else if (name === 'glow') {
    if (what === 'in') [440, 554.37, 659.25].forEach((f, i) => shimmer(t + i * 0.09, f, v * 0.3, 1.4));
    else if (what === 'crack') {
      shimmer(t, 880, v * 0.35, 0.7);
      shimmer(t + 0.12, 587.33, v * 0.3, 0.9);
    } else if (what === 'cue') shimmer(t, 1318.5, v * 0.12, 0.6);
    else shimmer(t, note() * 2, v * 0.3, 0.8);
  } else if (name === 'blueprint') {
    if (what === 'in') {
      pencil(t, 0.28, v * 0.5);
      ruler(t + 0.3, v);
    } else if (what === 'crack') {
      ruler(t, v);
      pencil(t + 0.04, 0.12, v * 0.5);
    } else if (what === 'cue') pencil(t, 0.04, v * 0.4);
    else pencil(t, 0.05, v * 0.6);
  } else if (name === 'ascii') {
    if (what === 'in') for (let i = 0; i < 6; i++) key(t + i * 0.055 + Math.random() * 0.02, v * 0.6);
    else if (what === 'crack') for (let i = 0; i < 3; i++) key(t + i * 0.035, v * 0.7);
    else key(t, v * 0.6);
  } else if (name === 'monet') {
    // oil: a loaded brush laid down, soft and short; coming in, three of them
    if (what === 'in') [0, 0.16, 0.3].forEach((d, i) => (hiss(t + d, 0.16, 700 + i * 160, 0.8, v * 0.5), bubble(t + d, rnd(150, 190), v * 0.5, 0.12)));
    else if (what === 'crack') hiss(t, 0.1, 1800, 1, v * 0.8);
    else {
      hiss(t, 0.14, rnd(650, 900), 0.8, v * 0.5);
      bubble(t + 0.01, rnd(160, 210), v * 0.6, 0.14);
    }
  } else if (name === 'qinghua') {
    // porcelain rings: a struck bowl coming in, a small clear ting for a press
    const ting = (at, f, len, k) => {
      tone('sine', f, at, len, v * k, f * 0.998, 0.002);
      tone('sine', f * 2.76, at, len * 0.5, v * k * 0.35, undefined, 0.002);
    };
    if (what === 'in') {
      ting(t, 1174.66, 1.6, 0.6);
      ting(t + 0.22, 1567.98, 1.2, 0.35);
    } else if (what === 'crack') {
      hiss(t, 0.03, 5200, 2, v);
      ting(t + 0.01, 2093, 0.5, 0.4);
    } else ting(t, rnd(1900, 2300), 0.6, 0.45);
  } else if (name === 'dunhuang') {
    // a cave: a low drum far off coming in; a press is dust, dry and brief
    if (what === 'in') {
      bubble(t, 82, v * 1.4, 0.5);
      bubble(t + 0.34, 98, v, 0.4);
      hiss(t + 0.05, 0.7, 900, 0.5, v * 0.2);
    } else if (what === 'crack') hiss(t, 0.12, 1400, 0.8, v);
    else {
      hiss(t, 0.22, rnd(1500, 2100), 0.6, v * 0.4);
      bubble(t, rnd(105, 125), v * 0.6, 0.12);
    }
  } else if (name === 'stars') {
    // the sky: thin high lights, far apart
    if (what === 'in') [987.77, 1318.5, 1975.5].forEach((f, i) => shimmer(t + i * 0.2, f, v * 0.2, 1.8));
    else if (what === 'crack') shimmer(t, 1760, v * 0.3, 0.8);
    else {
      shimmer(t, note() * 4, v * 0.22, 1.2);
      tone('sine', 2600, t, 0.5, v * 0.12, 900);
    }
  } else if (name === 'relief') {
    // stone: a chisel's dry knock, and sand running off as the look comes in
    const knock = (at, k) => (
      hiss(at, 0.02, 2600, 2.2, v * k), tone('triangle', rnd(300, 360), at, 0.05, v * k * 0.4), bubble(at, rnd(150, 170), v * k * 0.5, 0.06)
    );
    if (what === 'in') {
      hiss(t, 1.1, 1700, 0.5, v * 0.3);
      knock(t + 0.5, 0.7);
    } else if (what === 'crack') {
      knock(t, 1);
      knock(t + 0.07, 0.6);
    } else knock(t, 0.9);
  }
}
function plip(kind, vol) {
  if (!AC || muted) return;
  const t = AC.currentTime;
  // look-<name> comes in; press-, crack- and cue- are the look on show doing so
  const [what, name] = kind.split('-');
  if (name) {
    lookSound(name, what === 'look' ? 'in' : what, t, vol || 1);
    return;
  }
  if (kind === 'thunder') {
    // far off: a low roll a moment after the flash
    hiss(t + rnd(0.6, 1.4), 2.6, 70, 0.4, 0.09 * (vol || 1));
    hiss(t + rnd(0.8, 1.6), 1.8, 140, 0.6, 0.04 * (vol || 1));
    return;
  }
  if (kind === 'crack' && look !== 'water') {
    lookSound(look, 'crack', t, vol || 1);
    return;
  }
  if (kind === 'ink') {
    // a drop of ink: a soft low touch and a long breath of the brush
    const v = 0.07 * (vol || 1);
    hiss(t, 0.5, 900, 0.6, v * 0.35);
    bubble(t, rnd(180, 220), v, 0.4);
    return;
  }
  if (kind === 'stamp') {
    // a seal pressed down: a soft low thud, and the paper's small breath under it
    const v = 0.09 * (vol || 1);
    hiss(t, 0.06, 420, 0.7, v * 0.5);
    bubble(t + 0.004, rnd(96, 112), v, 0.16);
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
  // muted, the sound has nothing to do: it sleeps once the fade is done
  if (AC) on ? setTimeout(() => muted && AC.state === 'running' && AC.suspend(), 400) : AC.resume();
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

/* ================= the Dunhuang wall's painting (a preview look) =================
   The flying figures are pictures. They are fetched the first time the look is asked for, laid out for
   the wall's size into one canvas, and sent to the GPU once (and again only when the pond is resized);
   lookDunhuang() draws them under its own wear. Nothing here runs in the frame. */
let muralImgs = null,
  muralLarge = false,
  texMural = null;
const muralFaces = new Float32Array(6);
function loadMural() {
  if (muralImgs) return;
  muralImgs = {};
  Promise.all(
    Object.entries(MURAL).map(
      ([k, src]) =>
        new Promise((done) => {
          const im = new Image();
          im.onload = () => ((muralImgs[k] = im), done());
          im.onerror = done;
          im.src = src;
        })
    )
  ).then(() => {
    paintPic();
    invalidate();
  });
}
// The one texture a look's picture lies in holds the picture of the look last asked for.
let picLook = '',
  picIn = '';
function paintPic() {
  if (picLook === 'dunhuang') paintMural();
  else if (picLook === 'monet') paintBed();
  else if (picLook === 'qinghua') paintRim();
  else if (picLook === 'stars') paintPlate();
  else if (picLook === 'ukiyo') paintWaves();
  else if (picLook === 'relief') paintRelief();
}
// which looks have a picture in that texture, and how each fetches its own
const PICTURED = {
  dunhuang: () => loadMural(),
  monet: () => loadMonet(),
  qinghua: () => loadRim(),
  stars: () => loadStars(),
  ukiyo: () => loadWaves(),
  relief: () => loadRelief()
};
// The relief's carvings: each picture is a pair, its paint and its height. The paint is laid into the top
// half of the look's texture and the height into the bottom half, at the same places, so the shader reads
// both from one picture; where nothing is carved the height is the stone's face (mid grey).
let reliefImgs = null;
function loadRelief() {
  if (reliefImgs) return;
  reliefImgs = {};
  Promise.all(
    Object.entries(RELIEF).map(
      ([k, src]) =>
        new Promise((done) => {
          const im = new Image();
          im.onload = () => ((reliefImgs[k] = im), done());
          im.onerror = () => (report(new Error(`no picture at ${src}`), 'pond pictures'), done());
          im.src = src;
        })
    )
  ).then(() => {
    paintPic();
    invalidate();
  });
}
function paintRelief() {
  if (!glOK || !reliefImgs || !reliefImgs.friezeH) return;
  const k = Math.min(2048 / W, glc.width / W, 2),
    cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * k));
  cv.height = Math.max(2, Math.round(H * k) * 2);
  const c = cv.getContext('2d'),
    half = cv.height / 2;
  c.fillStyle = 'rgb(128,128,128)';
  c.fillRect(0, half, cv.width, half);
  // the stone's dressed face, tiled, is the ground of the height (640 pixels of the pond to a tile), at a
  // third of its depth: under a low light the full depth reads as grit, not as dressing
  if (reliefImgs.stoneH) {
    // (whole pixels to a tile, so no two tiles overlap: laid in thinly, an overlap would show as a line)
    const t = Math.round(640 * k);
    c.globalAlpha = 0.3;
    for (let x = 0; x < cv.width; x += t) for (let y = 0; y < half; y += t) c.drawImage(reliefImgs.stoneH, x, half + y, t, t);
    c.globalAlpha = 1;
  }
  for (const [pair, sx, sy, sw, sh, x, y, w, h] of reliefLayout(W, H, big)) {
    const paint = reliefImgs[`${pair}C`],
      height = reliefImgs[`${pair}H`];
    // a carving is drawn only whole: its paint without its height would be a flat picture on the stone
    if (!paint || !height) continue;
    // (a source read from its right edge back, a negative width, is mirrored)
    const put = (im, oy) => {
      if (sw >= 0) return c.drawImage(im, sx, sy, sw, sh, x * k, oy + y * k, w * k, h * k);
      c.save();
      c.translate((x + w) * k, oy + y * k);
      c.scale(-1, 1);
      c.drawImage(im, sx + sw, sy, -sw, sh, 0, 0, w * k, h * k);
      c.restore();
    };
    put(paint, 0);
    // (a height's mid grey is the face: laid in hard light it leaves the dressed stone as it is there, and
    // raises or cuts it where the carving does)
    c.globalCompositeOperation = 'hard-light';
    put(height, half);
    c.globalCompositeOperation = 'source-over';
  }
  sendPic(cv);
}
// Ukiyo-e's wave crests: the sheet itself is the texture (the shader picks a crest's cell), with smaller
// copies, since a crest is drawn well under the size it was cut at.
let waves = null;
function loadWaves() {
  if (waves) return;
  waves = new Image();
  waves.onload = () => {
    paintPic();
    invalidate();
  };
  waves.onerror = () => report(new Error(`no picture at ${UKIYO.waves}`), 'pond pictures');
  waves.src = UKIYO.waves;
}
// (the print's painted water lies in the top half of the same texture, fitted to the pond, upright on a
// phone; until it has come the top half is clear and the shader's own water shows)
let ukiyoBed = null;
function paintWaves() {
  if (!glOK || !waves || !waves.complete || !waves.naturalWidth) return;
  if (ukiyoBed === null) {
    ukiyoBed = false;
    const im = new Image();
    im.onload = () => {
      ukiyoBed = im;
      paintPic();
      invalidate();
    };
    im.onerror = () => report(new Error('no picture of the print’s water'), 'pond pictures');
    im.src = H > W * 1.15 ? UKIYO.bedTall : UKIYO.bed;
  }
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 1024;
  const c = cv.getContext('2d');
  if (ukiyoBed) {
    const f = Math.max(W / ukiyoBed.naturalWidth, H / ukiyoBed.naturalHeight),
      w = W / f,
      h = H / f;
    c.drawImage(ukiyoBed, (ukiyoBed.naturalWidth - w) / 2, (ukiyoBed.naturalHeight - h) / 2, w, h, 0, 0, 1024, 512);
  }
  c.drawImage(waves, 0, 512);
  sendPic(cv, gl.CLAMP_TO_EDGE, true);
}
// The star chart's grid: a picture that tiles on all four sides is the look's texture as it is, repeated,
// with smaller copies (lookStars lays a tile over 520 pixels of the pond), so the grid runs on past every
// edge as the sky turns. The koi's figure is kept as one row to the koi sheets' measure, for
// Koi.drawSprite to bend along a constellation.
let starImgs = null,
  starFigure = null;
function loadStars() {
  if (starImgs) return;
  starImgs = {};
  const get = (k, then) => {
    const im = new Image();
    im.onload = () => {
      starImgs[k] = im;
      then(im);
      invalidate();
    };
    im.onerror = () => report(new Error(`no picture at ${STARS[k]}`), 'pond pictures');
    im.src = STARS[k];
  };
  get('grid', () => paintPic());
  get('figures', (im) => {
    const [x, y, w, h] = STARS.figure,
      k = 900 / w,
      cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = FIGURE.rowH;
    cv.getContext('2d').drawImage(im, x, y, w, h, 62, (FIGURE.rowH - h * k) / 2, 900, h * k);
    starFigure = cv;
  });
}
const FIGURE = { rowH: 384, x1: 962 };
function paintPlate() {
  if (glOK && starImgs && starImgs.grid) sendPic(starImgs.grid, gl.REPEAT, true);
}
// 青花's rim: the lotus scroll tiled along all four sides (as many whole turns as fit, stretched a little to
// close), the corner piece in each corner, mirrored. It is the frame the page stands inside.
let rimImgs = null;
function loadRim() {
  if (rimImgs) return;
  rimImgs = {};
  for (const k of ['rim', 'corner', 'medallion']) {
    const im = new Image();
    im.onload = () => {
      rimImgs[k] = im;
      paintPic();
      invalidate();
    };
    im.src = QINGHUA[k];
  }
}
function paintRim() {
  if (!glOK || !rimImgs || !rimImgs.rim || !rimImgs.corner) return;
  const k = Math.min(2048 / W, glc.width / W, 2),
    cv = document.createElement('canvas'),
    b = big ? 41 : 23;
  cv.width = Math.max(1, Math.round(W * k));
  cv.height = Math.max(1, Math.round(H * k));
  const c = cv.getContext('2d');
  c.scale(k, k);
  // one side: tiles from a corner piece to the next, drawn along x from the origin
  const side = (len) => {
    const n = Math.max(1, Math.round(len / (b * 8))),
      tw = len / n;
    for (let i = 0; i < n; i++) c.drawImage(rimImgs.rim, i * tw, 0, tw + 0.5, b);
  };
  const place = (x, y, a, sx, len) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.scale(1, sx);
    side(len);
    c.restore();
  };
  place(b * 2, 0, 0, 1, W - b * 4);
  place(b * 2, H, 0, -1, W - b * 4);
  place(0, H - b * 2, -Math.PI / 2, 1, H - b * 4);
  place(W, H - b * 2, -Math.PI / 2, -1, H - b * 4);
  for (const [x, y, sx, sy] of [
    [0, 0, 1, 1],
    [W, 0, -1, 1],
    [0, H, 1, -1],
    [W, H, -1, -1]
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(sx, sy);
    c.drawImage(rimImgs.corner, 0, 0, b * 2, b * 2);
    c.restore();
  }
  // the dish's own painting, large and pale in the right of the bowl, clear of the title: two koi among lotus
  if (rimImgs.medallion && big) {
    const d = Math.min(H * 0.7, W * 0.42);
    c.globalAlpha = 0.24;
    c.drawImage(rimImgs.medallion, W * 0.74 - d / 2, H * 0.5 - d / 2, d, d);
    c.globalAlpha = 1;
  }
  sendPic(cv);
}
function sendPic(cv, wrap = gl.CLAMP_TO_EDGE, copies = false) {
  picIn = picLook;
  const was = gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE10);
  gl.bindTexture(gl.TEXTURE_2D, texMural);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, copies ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  if (copies) gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(was);
}
// Monet's pictures: the painted water (upright on a phone, the small one on a small window, the large one
// where the pond is drawn large), the lilies and the koi. Fetched the first time the look is asked for.
let monetImgs = null,
  lilyPic = null;
// The painted koi of the looks that have them (newlooks.js, KOI_SHEETS), fetched with the look. A visitor's
// koi is one of the sheet's plain ones with their colour laid on, made once for each colour and kept.
const koiSheets = {};
function loadKoi(name) {
  const d = KOI_SHEETS[name];
  if (!d || koiSheets[name]) return;
  const sh = (koiSheets[name] = { ...d, pic: null, maskA: null, made: new Map() }),
    pic = new Image();
  pic.onload = () => {
    if (d.height) carved(pic, d).then((cv) => ((sh.pic = cv), sh.made.clear(), invalidate()));
    else sh.pic = pic;
    invalidate();
  };
  pic.onerror = () => report(new Error(`no picture at ${d.src}`), 'pond pictures');
  pic.src = d.src;
  if (!d.mask) return;
  const m = new Image();
  m.onload = () => {
    // the mask comes as white on black: its whiteness becomes its cover
    const cv = document.createElement('canvas');
    cv.width = m.naturalWidth;
    cv.height = m.naturalHeight;
    const x = cv.getContext('2d');
    x.drawImage(m, 0, 0);
    const px = x.getImageData(0, 0, cv.width, cv.height);
    for (let i = 0; i < px.data.length; i += 4) {
      px.data[i + 3] = px.data[i];
      px.data[i] = px.data[i + 1] = px.data[i + 2] = 255;
    }
    x.putImageData(px, 0, 0);
    sh.maskA = cv;
    sh.made.clear();
  };
  m.src = d.mask;
}
// A carved koi sheet comes as paint, bare where the stone shows, and a height. The fish's canvas holds one
// picture, so the two are made into one: the koi's whole shape from the height (anything off the stone's
// face), the paint laid over a colour that stands for bare stone (`bare`), which the look's shader knows.
function carved(paint, d) {
  return new Promise((done) => {
    const hi = new Image();
    hi.onerror = () => report(new Error(`no picture at ${d.height}`), 'pond pictures');
    hi.onload = () => {
      const w = paint.naturalWidth,
        h = paint.naturalHeight,
        shape = document.createElement('canvas'),
        cv = document.createElement('canvas');
      shape.width = cv.width = w;
      shape.height = cv.height = h;
      const x = shape.getContext('2d');
      x.drawImage(hi, 0, 0, w, h);
      const px = x.getImageData(0, 0, w, h);
      for (let i = 0; i < px.data.length; i += 4) {
        px.data[i + 3] = Math.min(255, Math.abs(px.data[i] - 128) * 40);
        px.data[i] = px.data[i + 1] = px.data[i + 2] = 255;
      }
      x.putImageData(px, 0, 0);
      const c = cv.getContext('2d');
      // (a cut that passes through the face's own height on its way down leaves pinholes: the shape is
      // laid a pixel each way to close them)
      for (const [ox, oy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ])
        c.drawImage(shape, ox, oy);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = d.bare;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-atop';
      c.drawImage(paint, 0, 0);
      done(cv);
    };
    hi.src = d.height;
  });
}
// the colour one of the pond's own koi carries in its patches (its first that isn't white), in the look's
// palette if it keeps one
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function ownColour(k, palette) {
  const own = (k.patches.find((q) => q[3] !== WHITE && /^#[0-9a-f]{6}$/i.test(q[3])) || [0, 0, 0, RED])[3];
  if (!palette) return own;
  const [r, g, b] = rgbOf(own);
  let best = palette[0],
    bd = 1e9;
  for (const q of palette) {
    const [pr, pg, pb] = rgbOf(q),
      d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}
// a picture at half or a quarter of its size, made the first time it is asked for (each step a clean halving)
const smaller = new WeakMap();
function shrunk(pic, m) {
  if (m === 1) return pic;
  let set = smaller.get(pic);
  if (!set) smaller.set(pic, (set = {}));
  if (!set[m]) {
    const from = m === 0.25 ? shrunk(pic, 0.5) : pic,
      cv = document.createElement('canvas');
    cv.width = Math.ceil((pic.naturalWidth || pic.width) * m);
    cv.height = Math.ceil((pic.naturalHeight || pic.height) * m);
    cv.getContext('2d').drawImage(from, 0, 0, cv.width, cv.height);
    set[m] = cv;
  }
  return set[m];
}
// which picture a koi is drawn from, and how far down it its row starts
function koiPicture(k, sh) {
  if (k === host) return [sh.pic, sh.host * sh.rowH];
  if (k === you) return [sh.pic, sh.you * sh.rowH];
  const row = sh.others[Math.floor(k.seed * 7) % sh.others.length],
    colour = k.person ? k.dot : sh.own ? ownColour(k, sh.palette) : sh.patch,
    key = `${row}|${colour}`;
  let cv = sh.made.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = sh.rowH;
    const x = cv.getContext('2d');
    x.drawImage(sh.pic, 0, row * sh.rowH, 1024, sh.rowH, 0, 0, 1024, sh.rowH);
    x.globalCompositeOperation = 'source-atop';
    if (sh.wash) {
      x.globalAlpha = 0.55;
      x.fillStyle = sh.wash;
      x.fillRect(0, 0, 1024, sh.rowH);
    }
    if (sh.maskA && colour) {
      const t = document.createElement('canvas');
      t.width = 1024;
      t.height = sh.rowH;
      const y = t.getContext('2d');
      y.fillStyle = colour;
      y.fillRect(0, 0, 1024, sh.rowH);
      y.globalCompositeOperation = 'destination-in';
      y.drawImage(sh.maskA, 0, row * sh.rowH, 1024, sh.rowH, 0, 0, 1024, sh.rowH);
      x.globalAlpha = 0.86;
      x.drawImage(t, 0, 0);
    }
    if (sh.maskA) sh.made.set(key, cv);
  }
  return [cv, 0];
}
function loadMonet() {
  if (monetImgs) return;
  monetImgs = {};
  const get = (k, src, then) => {
    const im = new Image();
    im.onload = () => {
      monetImgs[k] = im;
      then(im);
      invalidate();
    };
    im.src = src;
  };
  get('bed', H > W * 1.15 ? MONET.bedTall : W * glDpr > 1500 ? MONET.bed : MONET.bedSmall, () => paintPic());
  get('lilies', MONET.lilies, (im) => {
    lilyPic = im;
    padsNow();
  });
}
function paintBed() {
  if (!glOK || !monetImgs || !monetImgs.bed) return;
  const im = monetImgs.bed,
    k = Math.min(2048 / W, glc.width / W, 2),
    cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * k));
  cv.height = Math.max(1, Math.round(H * k));
  // the painting covers the pond, cut at the sides or at top and bottom as the pond's shape needs
  const f = Math.max(cv.width / im.naturalWidth, cv.height / im.naturalHeight),
    w = im.naturalWidth * f,
    h = im.naturalHeight * f;
  cv.getContext('2d').drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
  sendPic(cv);
}
function paintMural() {
  if (!glOK || !muralImgs || !muralImgs.pipa) return;
  const k = Math.min(2048 / W, glc.width / W, 2),
    cv = document.createElement('canvas'),
    { draw, faces } = muralLayout(W, H, big);
  cv.width = Math.max(1, Math.round(W * k));
  cv.height = Math.max(1, Math.round(H * k));
  const c = cv.getContext('2d');
  c.scale(k, k);
  // a band across the very top and bottom of the wall, tiled
  if (muralImgs.border) {
    const bh = big ? 30 : 18,
      bw = bh * 8;
    c.globalAlpha = 0.85;
    for (let x = 0; x < W; x += bw) {
      c.drawImage(muralImgs.border, x, 0, bw, bh);
      c.drawImage(muralImgs.border, x, H - bh, bw, bh);
    }
    c.globalAlpha = 1;
  }
  for (const [im, sx, sy, sw, sh, x, y, w, h, strength = 1] of draw) {
    const pic = muralImgs[im];
    if (!pic) continue;
    // a picture that came larger than the layout's numbers is the same picture, scaled; a source drawn
    // from its right edge back (a negative width) is mirrored; a fainter one is further off, or more worn
    const f = pic.naturalWidth / (im === 'pipa' ? 1536 : pic.naturalWidth);
    c.globalAlpha = strength;
    if (sw < 0) {
      c.save();
      c.translate(x + w, y);
      c.scale(-1, 1);
      c.drawImage(pic, (sx + sw) * f, sy * f, -sw * f, sh * f, 0, 0, w, h);
      c.restore();
    } else c.drawImage(pic, sx * f, sy * f, sw * f, sh * f, x, y, w, h);
  }
  c.globalAlpha = 1;
  // the centrepiece is fetched again, larger, only where it is drawn wider than the first one has pixels
  // (while the picture's texture is at most 2048 across and she is half the wall, that is nowhere)
  const drawn = draw.find((d) => d[0] === 'pipa');
  if (!muralLarge && big && drawn && drawn[7] * k > 1536) {
    muralLarge = true;
    const im = new Image();
    im.onload = () => ((muralImgs.pipa = im), paintMural(), invalidate());
    im.src = MURAL_LARGE.pipa;
  }
  faces.forEach((f, i) => muralFaces.set(f, i * 3));
  sendPic(cv);
}

/* ================= the seal album (集印册) =================
   Each look has a seal (seals.ts). The first time a look comes in all the way, by whatever route, its seal is
   stamped in the corner and kept in this browser; the album is a sheet, opened from the command bar or from
   the small mark by the solar term, which shows once there is a seal to see. Someone who has found none is
   shown one quiet line on the water, once. None of it runs in the frame: a stamp is a CSS animation, and
   the line a timer. */
const VOLS = volumes(false);
let album = readAlbum(load('pond-seals'));
album = { ...album, visits: album.visits + 1 };
save('pond-seals', writeAlbum(album));
function setAlbum(a) {
  album = a;
  save('pond-seals', writeAlbum(a));
  koiSeals();
  sealsEntry();
  if (sheetOpen() && sheetId === 'seals') openSheet('seals');
}
// the visitor's koi wears a seal once the first volume is full, and the gold one once every volume is
function koiSeals() {
  if (you) you.seal = full(album, VOLS[0]);
  if (host) host.seal = allFull(album, VOLS);
}
function sealsEntry() {
  const b = $('#sealsBtn');
  b.hidden = !entryShows(album);
  b.toggleAttribute('data-some', sealCount(album) > 0);
  b.toggleAttribute('data-all', allFull(album, VOLS));
  b.setAttribute('aria-label', SEAL_WORDS[lang].title);
}
// the volumes whose large seal hasn't been seen yet: it stamps as the album opens, once
const freshVols = () => VOLS.filter((v) => full(album, v) && !album.sealed.includes(v.id)).map((v) => v.id);
// The seals cut in seal script are one picture, asked for the first time a seal is to be seen; until it
// has come (and if it never does) a seal is its characters in the brush.
function sealsPic() {
  // (kept on the function: the inscription may ask before this part of the file has run)
  if (sealsPic.asked) return;
  sealsPic.asked = true;
  const im = new Image();
  im.onload = () => pond.setAttribute('data-seals', '');
  im.src = '/pond/ink/seals.webp';
}
// a seal's characters are centred by their own ink, measured once the brush has come for them
function alignSeals(sel) {
  sealsPic();
  alignInk(sel);
  const chars = [...document.querySelectorAll(sel)].map((x) => x.textContent).join('');
  if (chars && document.fonts?.load)
    document.fonts.load("40px 'Zhi Mang Xing'", chars).then(
      () => alignInk(sel),
      () => {}
    );
}
function albumShown() {
  alignSeals('#sheet .seal-m span');
  const fresh = freshVols();
  if (!fresh.length) return;
  if (!RM) setTimeout(() => sheetOpen() && sheetId === 'seals' && plip('stamp'), 700);
  let a = album;
  for (const v of fresh) a = markSealed(a, v);
  album = a;
  save('pond-seals', writeAlbum(a));
}
let stampTimer = 0;
// a look has come in all the way: its seal, if this is the first time
function reached(id) {
  const r = stamp(album, id, dayOf(new Date()), VOLS);
  if (!r.fresh) return;
  sealsPic();
  album = r.album;
  save('pond-seals', writeAlbum(album));
  koiSeals();
  const seal = VOLS.flatMap((v) => v.seals).find((x) => x.id === id),
    el = $('#stamp');
  clearTimeout(stampTimer);
  delete el.dataset.on;
  stampTimer = setTimeout(
    () => {
      el.innerHTML = sealMark(seal);
      alignSeals('#stamp .seal-m span');
      $('#stampSay').textContent = `${SEAL_WORDS[lang].title}: ${SEAL_WORDS[lang].names[id]}`;
      el.dataset.on = '';
      plip('stamp');
      // the water takes the press
      const b = el.getBoundingClientRect(),
        pr = pond.getBoundingClientRect();
      if (!RM) drop(b.left - pr.left + b.width / 2, b.top - pr.top + b.height / 2, 2.4, 0.5);
      sealsEntry();
      invalidate();
      stampTimer = setTimeout(() => delete el.dataset.on, 3400);
    },
    RM ? 0 : 600
  );
}
// One line on the water for someone who has found no look: once the pond has settled and they have been
// here a while, or a moment after their first press. The gold koi comes over as it does at the opening.
// Never over a chapter, the command bar or the title's type; shown once, and not at all after a seal.
sealsEntry();
let hintTimer = 0;
function hintSoon(ms) {
  if (!mayHint(album)) return;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hint, ms);
}
function hint() {
  if (!mayHint(album)) return;
  if (sheetOpen() || palOpen() || look !== 'water' || !arrived || host.mode !== 'wander' || document.hidden) return void hintSoon(6000);
  const el = $('#whisper'),
    toc = $('#toc').getBoundingClientRect(),
    pr = pond.getBoundingClientRect(),
    wide = toc.width && toc.right - pr.left < W * 0.8;
  el.textContent = SEAL_WORDS[lang].line;
  // beside the title on a wide pond, under it on a narrow one; near the visitor's koi where that is open water
  const half = Math.min(W - 40, el.offsetWidth) / 2,
    left = wide ? toc.right - pr.left + 40 : 20,
    x = clamp(you.x, left + half, W - 20 - half),
    y = clamp(you.y + 54, wide ? 90 : toc.bottom - pr.top + 34, H - 130);
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.dataset.on = '';
  album = { ...album, hinted: dayOf(new Date()) };
  save('pond-seals', writeAlbum(album));
  {
    host.mode = 'visit';
    setTimeout(() => {
      if (host.mode === 'visit') {
        host.mode = 'wander';
        host.wander();
      }
    }, 7000);
  }
  invalidate();
  setTimeout(() => delete el.dataset.on, 6500);
}

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
// With ?preview, a visitor who has been before is welcomed back, and my koi comes over once.
const backGreeting = () => {
  const pool = WELCOME_BACK[lang] || WELCOME_BACK.en;
  return pool[(Math.random() * pool.length) | 0];
};
function greetVisitor() {
  host.mode = 'greet';
  setTimeout(() => {
    if (host.mode === 'greet') {
      host.mode = 'wander';
      host.wander();
    }
  }, 7000);
}
pv.back = returning();
// A word for whoever came: some for the hour, some for any hour, one picked each time.
function salute() {
  const h = new Date().getHours();
  if (zhOn) {
    const g = ZH.greetings,
      pool = [...(h < 5 || h >= 21 ? g.night : h < 12 ? g.morning : h < 17 ? g.afternoon : g.evening), ...g.any];
    return [pool[(Math.random() * pool.length) | 0], ''];
  }
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
  $('#hero').textContent = pv.back ? backGreeting() : hello;
  if (pv.back) later(1800, greetVisitor, id);
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
  if (ptr.moved && wet && look !== 'ink' && look !== 'blueprint') {
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
  if (look !== 'water' && onHost(x, y)) {
    setLook('water', [host.x, host.y]);
    plip('drop', 0.8);
    return;
  }
  // fireflies near a press take off
  for (const q of pv.flies) {
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < 160) {
      q.vx += ((q.x - x) / (d || 1)) * 90;
      q.vy += ((q.y - y) / (d || 1)) * 90;
    }
  }
  if (iceAt(x, y) > 0.5) {
    crack(x, y);
    return;
  }
  if (look !== 'water') {
    // on paper a press leaves a blot that spreads (in the other looks, rings or a burst), and the fish still come to it
    blots.unshift({ x, y, at: wall() });
    blots.length = Math.min(blots.length, 6);
    drop(x, y, 2, -0.5);
    feed(x, y);
    plip(`press-${look}`, 0.8);
    for (const k of kois) if (k !== you && Math.hypot(k.x - x, k.y - y) < 130) k.burst = 0.5;
    return;
  }
  drop(x, y, 3.2, -2);
  feed(x, y);
  plip('drop');
  for (const k of kois) if (k !== you && Math.hypot(k.x - x, k.y - y) < 130) k.burst = 0.7;
});

/* ================= the looks are found on the water itself ================= */
// Ink: press and hold still. Ukiyo-e: stir the water, round once. Glow: press the light on the water (the
// moon's, or the sun's glint). Blueprint: draw a long straight line. ASCII: type five letters. In a look,
// the same gesture does nothing; pressing the gold koi (mine) brings the water back, from the koi. Each
// builds up a cue first, so an ordinary press or stroke never surprises.
const gest = {
  down: false,
  strayed: false,
  holdTimer: 0,
  pts: [],
  t0: 0,
  x0: 0,
  y0: 0,
  hold: 0,
  turn: 0,
  len: 0,
  glint: 0,
  near: false,
  keys: [],
  letters: [],
  typed: 0
};
const toggleLook = (name, at) => {
  gest.down = false;
  gest.pts = [];
  if (look !== name) setLook(name, at);
};
const glintAt = () => [W * (big ? 0.6 : 0.74), H * (big ? 0.1 : 0.12)];
const HOLD = 1.2,
  HOLD_PX = 8,
  KEYS_TO_TYPE = 5,
  KEYS_WITHIN = 3,
  SHORTCUT = /^[iglfm]$/i;
{
  pond.addEventListener('pointerdown', (e) => {
    if (e.target.closest(DRY) || e.button > 0) return;
    const [x, y] = spot(e);
    if (look !== 'water' && onHost(x, y)) return;
    Object.assign(gest, { down: true, pts: [[x, y]], t0: e.timeStamp / 1000, x0: x, y0: y, hold: 0, turn: 0, len: 0, strayed: false });
    // A hold is decided by the pointer's own events: it must stay within HOLD_PX of where it went down for
    // HOLD seconds, by the events' timestamps. When the time is up, the decision waits for the next frame,
    // because pointer moves are delivered with frames: any move still queued from a busy frame comes first.
    clearTimeout(gest.holdTimer);
    gest.holdTimer = setTimeout(
      () =>
        requestAnimationFrame(() => {
          if (gest.down && !gest.strayed) toggleLook('ink', [gest.x0, gest.y0]);
        }),
      Math.max(0, HOLD * 1000 - (performance.now() - e.timeStamp))
    );
  });
  pond.addEventListener('pointermove', (e) => {
    if (!gest.down) {
      // a mouse over the light: it brightens a little, to be found
      const [x, y] = spot(e),
        [gx, gy] = glintAt();
      gest.near = Math.hypot(x - gx, y - gy) < 46;
      return;
    }
    // every point the pointer passed, even those a busy frame folded into one event
    for (const q of e.getCoalescedEvents?.() || [e]) {
      if (!gest.down) break;
      // (a move from before the press, delivered late with its frame, is no part of it)
      if (q.timeStamp / 1000 < gest.t0) continue;
      // past HOLD_PX within the hold's time, and this press is no longer a hold
      const [x, y] = spot(q);
      if (q.timeStamp / 1000 - gest.t0 < HOLD && Math.hypot(x - gest.x0, y - gest.y0) > HOLD_PX) gest.strayed = true;
      stroke(q);
    }
  });
  const stroke = (q) => {
    const [x, y] = spot(q),
      P = gest.pts,
      [px, py] = P[P.length - 1],
      d = Math.hypot(x - px, y - py);
    if (d < 3) return;
    // the heading turned since the last step, signed: a circle sums to a full turn, a line or a zigzag doesn't
    if (P.length > 1) {
      const [qx, qy] = P[P.length - 2];
      let da = Math.atan2(y - py, x - px) - Math.atan2(py - qy, px - qx);
      da = ((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      gest.turn += da;
    }
    gest.len += d;
    P.push([x, y]);
    if (P.length > 400) P.splice(1, 1);
    // the strokes that are rules of their own (gestures.ts): a rub over one spot, or once round the rim of the screen
    {
      const m = strokeMoving(P, W, H);
      if (m === 'dunhuang' || m === 'qinghua') {
        const xs = P.map((p) => p[0]),
          ys = P.map((p) => p[1]);
        return void toggleLook(m, m === 'qinghua' ? [x, y] : [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]);
      }
    }
    // (half way round a stir, the print's crests are sent for, so that it arrives as a wave)
    if (Math.abs(gest.turn) > Math.PI && look === 'water') loadWaves();
    // stirred once round, wide enough to be meant
    if (Math.abs(gest.turn) > Math.PI * 1.9 && gest.len > 260) {
      let xs = P.map((p) => p[0]),
        ys = P.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs),
        h = Math.max(...ys) - Math.min(...ys);
      if (Math.min(w, h) > 50) {
        xs = (Math.max(...xs) + Math.min(...xs)) / 2;
        ys = (Math.max(...ys) + Math.min(...ys)) / 2;
        toggleLook('ukiyo', [xs, ys]);
      }
    }
  };
  const lift = (e) => {
    if (!gest.down) return;
    const [x, y] = spot(e),
      dt = performance.now() / 1000 - gest.t0,
      ln = straightness();
    gest.down = false;
    clearTimeout(gest.holdTimer);
    const drawn = gest.pts;
    if (ln && ln.chord > 320) toggleLook('blueprint', [x, y]);
    else if (dt < 0.4 && gest.len < 10) {
      const [gx, gy] = glintAt();
      if (Math.hypot(x - gx, y - gy) < 46) toggleLook('glow', [gx, gy]);
      else {
        // taps: three far apart join as a triangle of stars; four in one place are dabs of paint
        const now = performance.now() / 1000;
        gest.taps = [...(gest.taps || []).filter((q) => now - q.t < 2), { t: now, x, y }];
        const t = tapsLook(gest.taps);
        if (t) {
          const at = t === 'stars' ? gest.taps.slice(-3) : gest.taps.slice(-4);
          gest.taps = [];
          toggleLook(t, [at.reduce((a, q) => a + q.x, 0) / at.length, at.reduce((a, q) => a + q.y, 0) / at.length]);
        }
      }
    } else if (strokeLifted(drawn) === 'relief') toggleLook('relief', [x, y]);
    gest.pts = [];
  };
  pond.addEventListener('pointerup', lift);
  pond.addEventListener('pointercancel', () => {
    clearTimeout(gest.holdTimer);
    gest.down = false;
    gest.pts = [];
  });
  // a stroke on the water never selects the type it passes over
  document.addEventListener('selectstart', (e) => {
    if (gest.down) e.preventDefault();
  });
  // a long press is ours on the water, not the browser's menu
  pond.addEventListener('contextmenu', (e) => {
    if (!e.target.closest(DRY)) e.preventDefault();
  });
  addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
    if (typing || e.metaKey || e.ctrlKey || e.altKey || palOpen() || sheetOpen() || !/^[a-z]$/i.test(e.key) || SHORTCUT.test(e.key)) return;
    const now = performance.now() / 1000;
    // each letter floats onto the water where the pointer is, and ripples away
    const x = ptr.x || W * (big ? 0.7 : 0.5),
      y = ptr.y || H * 0.6,
      k = { ch: e.key, at: now, x: x + rnd(-14, 14), y: y + rnd(-10, 10) };
    gest.keys = gest.keys.filter((q) => now - q.at < KEYS_WITHIN);
    gest.keys.push(k);
    gest.typed = gest.keys.length;
    gest.letters.push(k);
    drop(k.x, k.y, 1.6, -0.5);
    audio();
    plip('cue-ascii', 0.8);
    if (look !== 'ascii' && gest.keys.length >= KEYS_TO_TYPE) {
      gest.keys = [];
      toggleLook('ascii', [x, y]);
    }
  });
}
// how straight the stroke so far is: its chord, if every point keeps close to it
// In a look, a press on my koi comes before whatever lies over it (the contents, a control's glass), but
// not an open chapter, the search or a field: the water comes back, and the click goes nowhere else.
addEventListener(
  'pointerdown',
  (e) => {
    if (look === 'water' || sheetOpen() || palOpen() || e.button > 0 || e.target.closest('input, textarea, .veil, .pal-wrap')) return;
    const [x, y] = spot(e);
    if (x < 0 || y < 0 || x > W || y > H || !onHost(x, y)) return;
    e.preventDefault();
    e.stopPropagation();
    audio();
    setLook('water', [host.x, host.y]);
    plip('drop', 0.8);
    const swallow = (c) => {
      c.preventDefault();
      c.stopPropagation();
    };
    addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', swallow, { capture: true }), 600);
  },
  { capture: true }
);
// my koi, pressed in a look, brings the water back; it moves, so it is given room
function onHost(x, y) {
  if (!host || host.alpha < 0.3) return false;
  if (Math.hypot(x - host.x, y - host.y) < 70) return true;
  return (host.spine || []).some((p) => Math.hypot(x - p.x, y - p.y) < 46);
}
function straightness() {
  const P = gest.pts;
  if (P.length < 2) return null;
  const [ax, ay] = P[0],
    [bx, by] = P[P.length - 1],
    chord = Math.hypot(bx - ax, by - ay);
  if (chord < 60 || gest.len > chord * 1.08) return null;
  let off = 0;
  for (const [x, y] of P) off = Math.max(off, Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / chord);
  return off < Math.max(9, chord * 0.035) ? { chord, ax, ay, bx, by } : null;
}
// the cues, drawn in the air: ink gathering under a held finger, the stirred path, a ruler, the typed letters
function stepGesture() {
  gest.glint += ((gest.near ? 1 : 0) - gest.glint) * Math.min(1, lifeRaw * 7);
  if (gest.down && !gest.strayed) {
    const held = performance.now() / 1000 - gest.t0;
    if (gest.hold < 0.3 && held >= 0.3 && look !== 'ink') plip('cue-ink');
    gest.hold = held;
  } else gest.hold = 0;
}
function drawGesture(c) {
  const now = performance.now() / 1000,
    back = (name) => look === name;
  c.save();
  // ink gathering: a drop swelling under the finger, ragged at its edge (going back, a pale one)
  if (gest.down && gest.hold > 0.25) {
    const k = clamp((gest.hold - 0.25) / (HOLD - 0.25), 0, 1),
      r = 6 + 34 * k * k;
    c.fillStyle = back('ink') ? `rgba(240,233,216,${0.85 * k})` : `rgba(20,18,16,${0.8 * k})`;
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU,
        rr = r * (1 + 0.12 * Math.sin(a * 5 + now * 3) * k);
      c.lineTo(gest.x0 + Math.cos(a) * rr, gest.y0 + Math.sin(a) * rr);
    }
    c.fill();
  }
  // the stir: the path traced so far, fainter at its tail, firmer as it comes round
  if (gest.down && gest.pts.length > 6 && Math.abs(gest.turn) > Math.PI * 0.6) {
    const k = clamp(Math.abs(gest.turn) / (Math.PI * 1.9), 0, 1),
      P = gest.pts;
    c.lineCap = 'round';
    c.lineWidth = 2.5;
    for (let i = 1; i < P.length; i++) {
      c.strokeStyle = `rgba(246,237,216,${0.6 * k * (i / P.length)})`;
      c.beginPath();
      c.moveTo(P[i - 1][0], P[i - 1][1]);
      c.lineTo(P[i][0], P[i][1]);
      c.stroke();
    }
  }
  // the ruler: once the stroke is straight and long enough to mean it, a faint line with ticks
  const ln = gest.down && straightness();
  if (ln && ln.chord > 80) {
    const k = clamp((ln.chord - 80) / 240, 0, 1),
      ux = (ln.bx - ln.ax) / ln.chord,
      uy = (ln.by - ln.ay) / ln.chord;
    c.strokeStyle = `rgba(225,240,255,${0.25 + 0.55 * k})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ln.ax, ln.ay);
    c.lineTo(ln.bx, ln.by);
    for (let d = 0; d <= ln.chord; d += 20) {
      const t = d % 100 ? 4 : 9;
      c.moveTo(ln.ax + ux * d - uy * t, ln.ay + uy * d + ux * t);
      c.lineTo(ln.ax + ux * d, ln.ay + uy * d);
    }
    c.stroke();
    c.fillStyle = `rgba(225,240,255,${0.35 + 0.55 * k})`;
    c.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    c.fillText(`${(ln.chord / 100).toFixed(2)} m`, ln.bx + 8, ln.by - 8);
  }
  // the light on the water, found: a thin ring around it
  if (gest.glint > 0.05) {
    const [gx, gy] = glintAt();
    c.lineWidth = 1;
    for (const [r, o] of [
      [20, 0.85],
      [34, 0.4]
    ]) {
      c.strokeStyle = `rgba(255,250,235,${o * gest.glint})`;
      c.beginPath();
      c.arc(gx, gy, r + 3 * Math.sin(now * 3 + r), 0, TAU);
      c.stroke();
    }
  }
  // the letters typed: each lands on the water as a glyph, and a ring goes out from it as it sinks
  gest.letters = gest.letters.filter((q) => now - q.at < 2.2);
  if (gest.letters.length) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const q of gest.letters) {
      const a = now - q.at,
        f = Math.max(0, 1 - a / 2.2);
      c.font = `500 ${Math.round(24 + a * 6)}px 'JetBrains Mono', ui-monospace, monospace`;
      c.fillStyle = `rgba(225,242,236,${0.95 * f})`;
      c.fillText(q.ch, q.x, q.y);
      c.strokeStyle = `rgba(225,242,236,${0.35 * f})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(q.x, q.y, 10 + a * 46, 0, TAU);
      c.stroke();
    }
  }
  drawNewCues(c, now);
  c.restore();
}
// The preview looks' cues: the taps so far (dabs of paint where they are close, stars joined by a line
// where they are far apart), and a stroke that is neither round nor ruled, drawn as it goes: a rub's
// passes, or a tick once it has turned its corner.
function drawNewCues(c, now) {
  const taps = (gest.taps = (gest.taps || []).filter((q) => now - q.t < 1.8));
  if (taps.length && look === 'water') {
    const close = taps.length > 1 && taps.every((q) => Math.hypot(q.x - taps[0].x, q.y - taps[0].y) < 90);
    c.lineWidth = 1;
    taps.forEach((q, i) => {
      const f = 1 - (now - q.t) / 1.8;
      if (close) {
        c.fillStyle = `rgba(${['242,160,168', '150,170,230', '240,213,138', '140,190,150'][i % 4]},${0.7 * f})`;
        c.beginPath();
        c.ellipse(q.x, q.y, 9, 5, i * 0.7, 0, TAU);
        c.fill();
      } else {
        c.fillStyle = `rgba(233,237,248,${0.9 * f})`;
        c.beginPath();
        c.arc(q.x, q.y, 2.4, 0, TAU);
        c.fill();
        if (i) {
          c.strokeStyle = `rgba(214,224,248,${0.45 * f})`;
          c.beginPath();
          c.moveTo(taps[i - 1].x, taps[i - 1].y);
          c.lineTo(q.x, q.y);
          c.stroke();
        }
      }
    });
  }
  const P = gest.pts;
  if (gest.down && P.length > 8 && gest.len > 70 && Math.abs(gest.turn) < Math.PI * 0.6 && !straightness()) {
    c.lineCap = c.lineJoin = 'round';
    c.lineWidth = 2;
    // (a stroke that is neither a turn nor a ruled line leaves its trace: a zigzag is read when it lifts)
    c.strokeStyle = 'rgba(236,222,190,0.5)';
    c.beginPath();
    P.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
    c.stroke();
  }
}

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
  if (zhOn) {
    let his24 = '';
    try {
      his24 = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(d);
    } catch (err) {
      /* no time zones here: his hour goes unsaid */
    }
    $('#clockBig').textContent = `${h}:${mm}`;
    $('#clockPart').textContent = ZH.clock.yours;
    $('#hisTime').textContent = his24 ? `${ZH.clock.mine} · ${his24}` : ZH.clock.mine;
  }
  if (phaseChoice === 'auto') setPhase('auto');
  const lt = $('#letterTime');
  if (lt) lt.textContent = zhOn ? `${ZH.clock.now} ${h}:${mm}。` : `${h % 12 || 12}:${mm} ${part}${city ? ' in ' + city : ' where you are'}`;
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
/* ================= the loop's pace =================
   At most 60 frames a second while something happens, 30 once nothing has for a while (no input, the
   water settled, no look coming in, no rain), each on the display's own beat so they come evenly (clock.js);
   none while the tab is hidden. Under reduced motion the koi still swim, at the quiet pace: a pond
   that stopped a moment after the pointer did looked broken. invalidate() wakes it. A beat that isn't drawn on costs nothing but the callback. */
let rainAcc = 0;
let last = 0,
  running = false,
  beatAt = 0,
  vsync = 1000 / 60,
  wokeAt = 0,
  calmAt = 0,
  energyAt = 0,
  slow = 0,
  quality = 1,
  gpuMs = null,
  lifeRaw = 0.033,
  // the GPU's own time for the water and glass passes, where the browser can measure it (one query at a time)
  tq = null,
  tqQ = null,
  tqOn = false,
  gpuAvg = null,
  hot = 0,
  cool = 0,
  // the window in the background, or the battery low and not charging: the pond keeps the quiet pace
  away = false,
  saving = false;
addEventListener('blur', () => (away = true));
addEventListener('focus', () => ((away = false), invalidate()));
navigator
  .getBattery?.()
  .then((b) => {
    const f = () => ((saving = !b.charging && b.level <= 0.2), invalidate());
    f();
    b.addEventListener('chargingchange', f);
    b.addEventListener('levelchange', f);
  })
  .catch(() => {});
function invalidate() {
  wokeAt = performance.now();
  if (AC && AC.state === 'suspended' && !muted && !document.hidden) AC.resume();
  if (running || document.hidden) return;
  running = true;
  last = 0;
  beatAt = 0;
  requestAnimationFrame(frame);
}
// how much the water is moving, looked at twice a second: a press's rings keep the pace up until they settle
function stirred(now) {
  if (now - energyAt < 500) return calmAt;
  energyAt = now;
  let m = 0;
  for (let k = 0; k < hA.length; k += 7) m = Math.max(m, Math.abs(hA[k]));
  if (m > 0.12) calmAt = now;
  return calmAt;
}
function busy(now) {
  // a look coming in is always drawn at the full pace, and so is a finger or pointer held down
  if (top !== base || (look === 'water' && inkR > 0) || gest.down) return true;
  if (away || saving) return false;
  // under a chapter or the palette the pond is mostly hidden: only what was just touched keeps the pace up
  if (sheetOpen() || palOpen()) return now - wokeAt < 1500;
  return (
    now - wokeAt < IDLE_AFTER * 1000 ||
    now - stirred(now) < 2000 ||
    rainNow() ||
    meteorsNow() ||
    top !== base ||
    (look === 'water' && inkR > 0) ||
    gest.down ||
    gest.letters.length > 0 ||
    now < panesUntil
  );
}
// Where the GPU's time can be read, the water draws fewer pixels only when the GPU is short of time: its
// two passes taking more than 70% of a frame for a while, steps of a tenth, never below 0.8; and back up as
// soon as the next step up would fit in half a frame. Elsewhere, frames whose own work runs long draw fewer.
function gpuTime() {
  if (tqOn) {
    gl.endQuery(tq.TIME_ELAPSED_EXT);
    tqOn = false;
  }
  if (!tqQ || !gl.getQueryParameter(tqQ, gl.QUERY_RESULT_AVAILABLE)) return;
  const ok = !gl.getParameter(tq.GPU_DISJOINT_EXT);
  if (ok) gpuMs = gl.getQueryParameter(tqQ, gl.QUERY_RESULT) / 1e6;
  gl.deleteQuery(tqQ);
  tqQ = null;
  if (!ok) return;
  gpuAvg = gpuAvg == null ? gpuMs : gpuAvg * 0.8 + gpuMs * 0.2;
  const frameMs = 1000 / FPS,
    up = Math.min(1, quality / 0.9);
  if (gpuAvg > frameMs * 0.7 && quality > 0.8) {
    cool = 0;
    if (++hot > 20) {
      quality = Math.max(0.8, quality * 0.9);
      hot = 0;
      gpuAvg = null;
      sizeGL();
    }
  } else if (quality < 1 && gpuAvg * (up / quality) ** 2 < frameMs * 0.5) {
    hot = 0;
    if (++cool > 30) {
      quality = up;
      cool = 0;
      gpuAvg = null;
      sizeGL();
    }
  } else hot = Math.max(0, hot - 1);
}
function afterFrame(started) {
  const now = performance.now();
  if (tq) gpuTime();
  else if (now - started > 45) {
    if (++slow > 45 && quality > 0.7) {
      quality = Math.max(0.7, quality * 0.85);
      slow = 0;
      sizeGL();
    }
  } else slow = Math.max(0, slow - 1);
  // a minute with nothing happening, and the sound sleeps until the next touch
  if (AC && AC.state === 'running' && now - wokeAt > 60000 && !music().playing) AC.suspend();
}
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, invalidate, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
    if (AC && AC.state === 'running') AC.suspend();
  } else {
    invalidate();
    if (AC && !muted) AC.resume();
  }
});
new MutationObserver(invalidate).observe(pond, { attributes: true });
// a pane shown, hidden or opened without a transition is read again too
new MutationObserver(() => (panesLive(), invalidate())).observe(pond, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class', 'data-open'] });
function frame(now) {
  if (beatAt) vsync = learnBeat(vsync, now - beatAt);
  beatAt = now;
  if (document.hidden) return void (running = false);
  requestAnimationFrame(frame);
  // reduced motion keeps the koi swimming (its other calming is elsewhere), at the quiet pace
  if (!due(now, last, vsync, !RM && busy(now))) return;
  const started = performance.now();
  const raw = last ? Math.min(0.05, (now - last) / 1000) : 1 / 30;
  last = now;
  lifeRaw = raw;
  try {
    span('frame', () => tick1(raw));
  } finally {
    afterFrame(started);
    if (PERF) frameDone(now, { gpu: gpuMs, scale: `${glc.width}×${glc.height}`, quality, pass: ['whole', 'water'][passNow] || 'look' });
  }
}
function tick1(raw) {
  stepInk(raw);
  // in ink, time runs slow: everything that moves is stepped by dt
  const dt = raw * timeScale;
  T += dt;
  lifeDt = dt;
  panesMoved(performance.now());
  panes();
  stepYear(dt);
  holes();
  focus += (focusGoal - focus) * Math.min(1, dt * 6);
  // the page is written only when what it shows changes
  const knobAt = (Math.round(focus * 1000) / 10).toFixed(1) + '%';
  if (knobAt !== knobWas) knobEl.style.top = knobWas = knobAt;
  const live = T < focusLive;
  if (live !== gaugeWas) gaugeEl.toggleAttribute('data-live', (gaugeWas = live));
  // rain over open water; over ice it comes as snow instead
  // in a look the drops are smaller and fewer: a soft bloom in ink, a small ring in the print, a dot in ASCII
  if (rainNow() && AM.ice < 0.3) {
    // drops a second, on time: about a hundred over a wide pond in steady rain; drizzle fewer, a storm more
    const k = { water: 1, ukiyo: 0.2 }[look] ?? 0.35,
      hard = rainChosen || !wx ? 1 : Math.max(0.3, fx.rain);
    rainAcc += raw * (big ? 99 : 33) * hard * (look === 'water' ? 1 : 0.5);
    for (; rainAcc >= 1; rainAcc--) {
      const x = rnd(0, W),
        y = rnd(0, H);
      // on paper a drop doesn't ring: it blooms, a soft grey that spreads and dries
      if (look === 'ink') {
        blooms.push({ x, y, at: wall(), r: rnd(5, 11) });
        if (blooms.length > 28) blooms.shift();
      } else drop(x, y, 1.1, -rnd(0.25, 0.7) * k);
    }
  }
  // a storm, over the water only: now and then a far flash, and its thunder after
  if (fx.thunder && raining && !rainChosen && look === 'water' && Math.random() < raw / 35) {
    flashAt = T;
    plip('thunder');
  }
  span('koi', () => {
    for (const k of kois) k.update(dt);
  });
  // the ripples step on time: the same speed whatever the frame rate
  const [steps, left] = simSteps(simAcc, raw, timeScale);
  simAcc = left;
  span('sim', () => {
    for (let i = 0; i < steps; i++) stepSim();
  });
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
    const op = hid ? '0' : (k === you || k === host) && 'on' in k.tag.dataset ? '' : near ? '1' : '';
    // a tag that shows moves with its koi; one that doesn't is left alone
    if (op !== '0' && (op !== '' || 'on' in k.tag.dataset)) setStyle(k.tag, 'transform', `translate3d(${Math.round(k.x + 16)}px,${Math.round(k.y + 18)}px,0)`);
    setStyle(k.tag, 'opacity', op);
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
    if (on) setStyle(tag, 'transform', `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`);
    if (on !== 'on' in tag.dataset) tag.toggleAttribute('data-on', on);
  }
  span('air', drawAir);
  if (!glOK) return;
  span('fish', drawKoi);
  // the top layer (boats, food, petals, leaves) changes slowly: drawn and sent ten times a second
  const topNow = performance.now() - topAt > 100;
  if (topNow) {
    topAt = performance.now();
    span('top', drawTop);
  }
  const glAt = PERF ? performance.now() : 0;
  if (tq && !tqQ) {
    tqQ = gl.createQuery();
    gl.beginQuery(tq.TIME_ELAPSED_EXT, tqQ);
    tqOn = true;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
  gl.viewport(0, 0, glc.width, glc.height);
  // with no look shown the water alone is drawn, and a look alone once it covers the water
  const shown = top !== 'water' && SID[top] !== SID[base] ? inkR : SID[top] ? inkMax : 0,
    inkW = shown > 0 ? (look !== 'water' && inkR >= inkMax ? 1 : 0.5) : 0,
    wp = waterProg(inkW === 0 ? 1 : inkW === 1 ? 1 + SID[top] : 0);
  U = progU.get(wp);
  passNow = progs.indexOf(wp);
  gl.useProgram(wp);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  // textures are made once for each size, and after that only their contents are sent
  const key = `${GW}x${GH} ${fishCv.width}x${fishCv.height}`,
    fresh = key !== upKey;
  upKey = key;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texH);
  if (fresh) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, GW, GH, 0, gl.RED, gl.FLOAT, hA);
  else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.FLOAT, hA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texFish);
  if (fresh) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fishCv);
  else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, fishCv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, texTop);
  if (fresh || topNow) {
    if (fresh) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, topCv);
    else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, topCv);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
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
  if (U.uMural) {
    gl.uniform1i(U.uMural, 10);
    gl.uniform3fv(U.uFace, muralFaces);
    gl.uniform1f(U.uPic, picIn === look ? 1 : 0);
  }
  gl.uniform1f(U.uSprite, koiSheets[look] && koiSheets[look].pic ? 1 : 0);
  gl.uniform2f(U.uRes, glc.width, glc.height);
  gl.uniform2f(U.uGrid, GW, GH);
  gl.uniform2f(U.uMoonPos, big ? 0.6 : 0.74, big ? 0.1 : 0.12);
  // under reduced motion a look comes and goes as a plain cross-fade (the front's place is its progress)
  const fade = RM && inkW === 0.5,
    since = performance.now() / 1000 - inkAt;
  gl.uniform4f(U.uInk, fade ? shown / inkMax : shown, inkO[0], inkO[1], fade ? 0.25 : inkW);
  // how long the look on show has been arriving (what each builds up after its front), or leaving
  gl.uniform1f(U.uLookT, look === 'water' || RM ? 99 : since);
  gl.uniform1f(U.uDay, dayNow());
  // whether the pads and what floats are the look's own pictures, to be laid in as they are
  gl.uniform2f(U.uArt, artOf('pads') ? 1 : 0, artOf('afloat') ? 1 : 0);
  gl.uniform1f(U.uLeave, look === 'water' && inkR > 0 && !RM ? since : -1);
  gl.uniform1i(U.uStyle, SID[top]);
  gl.uniform1i(U.uPrev, SID[base]);
  gl.uniform1f(U.uGlint, (1 + gest.glint) * fx.glint);
  for (let i = 0; i < 10; i++) {
    const b = blots[i];
    blotU.set(b ? [b.x, b.y, wall() - b.at] : [0, 0, -1], i * 3);
  }
  gl.uniform3fv(U.uBlot, blotU);
  calmNow += (('clear' in pond.dataset ? 0 : 1) - calmNow) * Math.min(1, lifeDt * 3);
  gl.uniform2f(U.uCalm, big ? 0 : 1, calmNow);
  gl.uniform1f(U.uTime, RM ? 3 : T);
  gl.uniform1f(U.uSwell, RM ? 0 : 1);
  gl.uniform1f(U.uFocus, focus);
  gl.uniform1f(U.uIce, AM.ice);
  gl.uniform1f(U.uSnow, AM.snow);
  const flash = Math.exp(-(T - flashAt) * 7) * 0.9;
  gl.uniform1f(U.uAmb, cur.amb * fx.light + flash);
  gl.uniform1f(U.uCaI, cur.cai * AM.light * fx.light);
  gl.uniform1f(U.uMoon, cur.moon * Math.max(0.15, fx.glint) * (pv.fest === 'midautumn' ? 1.35 : 1));
  gl.uniform1f(U.uFog, fx.fog);
  // the moon as it is tonight (full, and brighter, at Mid-Autumn); stars on a clear night
  const age = pv.fest === 'midautumn' ? 0.5 : pv.age;
  gl.uniform3f(U.uMoonPh, moonLit(age), age < 0.5 ? 1 : -1, 1);
  gl.uniform1f(U.uStars, phase === 'night' && fx.glint > 0.9 ? Math.min(1, cur.moon) : 0);
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
  // the glass's soft copy: the scene shrunk to a quarter, and its smaller copies made from that
  if (paneN) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sceneFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, blurFbo);
    gl.blitFramebuffer(0, 0, glc.width, glc.height, 0, 0, blurW, blurH, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, texBlur);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, glc.width, glc.height);
  gl.useProgram(glassProg);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, texScene);
  gl.activeTexture(gl.TEXTURE9);
  gl.bindTexture(gl.TEXTURE_2D, texBlur);
  gl.uniform1i(UG.uBlur, 9);
  gl.activeTexture(gl.TEXTURE8);
  gl.bindTexture(gl.TEXTURE_2D, texShade);
  shadeUniforms(lifeDt);
  gl.uniform1i(UG.uScene, 4);
  gl.uniform2f(UG.uCss, W, H);
  gl.uniform1f(UG.uLod, 2.4 + Math.log2(glDpr));
  gl.uniform1f(UG.uFrost, Math.max(AM.ice, AM.snow * 0.8));
  // the glass turns to paper with the pond
  const pk = clamp(inkR / inkMax, 0, 1),
    gs = [0.03 + cur.tint[0] * 0.03, 0.09 + cur.tint[1] * 0.04, 0.1 + cur.tint[2] * 0.045],
    GT = { ink: [0.95, 0.92, 0.85], ukiyo: [0.07, 0.17, 0.32], glow: [0.01, 0.02, 0.05], blueprint: [0.08, 0.24, 0.5], ...NEW_GLASS },
    gt = GT[top] || gs,
    gf = GT[base] || gs;
  gl.uniform3f(UG.uGlass, lerpN(gf[0], gt[0], pk), lerpN(gf[1], gt[1], pk), lerpN(gf[2], gt[2], pk));
  // the text: inside the front when ASCII comes in, outside it when another look comes in over it
  const ascW = top === 'ascii' ? 1 : base === 'ascii' ? -1 : 0;
  if (ascW) atlas();
  gl.uniform4f(UG.uAscii, ascW > 0 && base === 'ascii' ? 1e5 : shown, inkO[0], inkO[1], ascW);
  gl.uniform2f(UG.uCell, CELL[0], CELL[1]);
  gl.uniform1i(UG.uAtlas, 7);
  gl.uniform4fv(UG.uPane, paneA);
  gl.uniform4fv(UG.uPaneB, paneB);
  gl.uniform1i(UG.uPaneN, paneN);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (PERF) add('gl', performance.now() - glAt);
}
// write a style only when it changes
const setStyle = (el, k, v) => {
  if (el.style[k] !== v) el.style[k] = v;
};
let topAt = -1e9,
  knobWas = '',
  gaugeWas = null;
const knobEl = $('#knob'),
  gaugeEl = $('#gauge');
const crackU = new Float32Array(24),
  brokeU = new Float32Array(6),
  doveTag = Object.assign(document.createElement('span'), { className: 'tag', textContent: 'Devot' }),
  spiderTag = Object.assign(document.createElement('span'), { className: 'tag', textContent: 'ocra' });
$('#tags').append(doveTag, spiderTag);
// Settled: the opening has played and the browser is idle. What isn't on the first screen loads then.
const settled = new Promise((resolve) => setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => resolve()), 2600));
// The dove and the spider are rendered sprites (sprites.js): each sheet is fetched the first time its
// creature is to be drawn, never on the first screen.
settled.then(() => {
  life = { DOVE: SPRITES.dove.half, SPIDER: SPRITES.spider.half, pic: spritePics(invalidate) };
});
settled.then(() => {
  // (the whole pass starts building now, in the background, so the first look finds it ready)
  if (glOK) waterProg(0);
  settledNow = true;
  padKey = '';
  topAt = -1e9;
  padsNow();
  invalidate();
});
settled.then(loadSongs);
settled.then(() => hintSoon(20000));
// The weather where the visitor is: once the pond has settled, so it never holds up the title page; again
// every half hour while it's shown (weather.ts keeps it for half an hour, so a reload doesn't fetch).
function weatherLine() {
  const w = wx,
    names = {
      clear: ['Clear', '晴', '晴れ'],
      cloudy: ['Cloudy', '多云', 'くもり'],
      overcast: ['Overcast', '阴', 'くもり'],
      fog: ['Fog', '雾', '霧'],
      drizzle: ['Drizzle', '小雨', '小雨'],
      rain: ['Rain', '雨', '雨'],
      snow: ['Snow', '雪', '雪'],
      storm: ['Storm', '雷雨', '雷雨']
    }[w.condition],
    i = lang === 'zh' ? 1 : lang === 'ja' ? 2 : 0,
    head = ['Weather where you are', '你那里的天气', 'あなたのところの天気'][i];
  return `${head}${i ? '：' : ': '}${names[i]}${i ? '，' : ', '}${w.temp}°${w.unit}${i ? '，' : ', '}${w.city}`;
}
function weatherIn(w) {
  if (!w) return;
  wx = w;
  fx = effectsOf(w.condition);
  {
    // the wind, gently: its direction is where it blows from, so the drift goes the other way
    const k = (Math.min(40, w.windSpeed) / 40) * 26 + 3,
      th = (w.windFrom * Math.PI) / 180;
    pv.windX = -Math.sin(th) * k;
    pv.windY = Math.cos(th) * k;
    // Qingming: softer light, and a drizzle if the sky allows
    if (pv.fest === 'qingming') fx = { ...fx, rain: Math.max(fx.rain, w.condition === 'clear' ? 0 : 0.5), light: fx.light * 0.9 };
  }
  if (!rainChosen) raining = fx.rain > 0;
  pond.toggleAttribute('data-fog', fx.fog > 0);
  if (south !== w.latitude < 0) {
    south = w.latitude < 0;
    amounts(year);
    padsNow();
    setIce();
    paintInk();
  }
  if (phaseChoice === 'auto') setPhase('auto');
  invalidate();
}
settled.then(() => loadWeather().then(weatherIn));
// With ?preview, quiet ambience under the sound switch: cicadas on summer days, crickets on summer and
// autumn nights, soft rain on the water. Each a short loop made once in code; looked at every two seconds.
const amb = {};
function ambLoop(name, secs, fill, gainTo) {
  if (!amb[name]) {
    const buf = AC.createBuffer(1, Math.round(AC.sampleRate * secs), AC.sampleRate),
      d = buf.getChannelData(0);
    fill(d, AC.sampleRate);
    const src = AC.createBufferSource(),
      g = AC.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = 0;
    src.connect(g);
    g.connect(sfx);
    src.start();
    amb[name] = g;
  }
  amb[name].gain.setTargetAtTime(gainTo, AC.currentTime, 1.5);
}
function ambience() {
  if (!AC || muted || document.hidden) return;
  const summer = AM.flies > 0.3,
    autumn = AM.leaves > 0.3;
  ambLoop(
    'cicadas',
    3,
    (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr,
          buzz = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 140);
        d[i] = (Math.random() * 2 - 1) * buzz * buzz * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 0.33)) * 0.5;
      }
      // pushed up into the cicadas' range by a simple high pass
      let p = 0;
      for (let i = 0; i < d.length; i++) {
        const x = d[i];
        d[i] = x - p;
        p = x;
      }
    },
    summer && phase === 'day' ? 0.006 : 0
  );
  ambLoop(
    'crickets',
    2,
    (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr,
          beat = t % 0.8,
          on = beat < 0.21 && beat % 0.07 < 0.035;
        d[i] = on ? Math.sin(t * 2 * Math.PI * 4300) * 0.5 * Math.sin(((beat % 0.07) * Math.PI) / 0.035) : 0;
      }
    },
    (summer || autumn) && phase === 'night' ? 0.008 : 0
  );
  ambLoop(
    'rain',
    4,
    (d) => {
      let v = 0;
      for (let i = 0; i < d.length; i++) {
        v = v * 0.86 + (Math.random() * 2 - 1) * 0.14;
        d[i] = v * Math.min(1, i / 4000, (d.length - i) / 4000);
      }
    },
    raining && look === 'water' ? 0.025 * Math.max(0.5, fx.rain || 1) : 0
  );
}
setInterval(ambience, 2000);
// The panel (only with ?preview, or in a build made for it): force each state, to see it now
if (PANEL)
  pond.append(
    panel({
      looks: LOOKS,
      album: () => openSheet('seals'),
      stampAll: () => VOLS.flatMap((v) => v.seals).forEach((x, i) => setTimeout(() => reached(x.id), i * 3400)),
      clearSeals: () => setAlbum(clearSeals(album)),
      festival(name) {
        pv.fest = name;
        pv.lanterns = [];
        pv.boatAt = -1e9;
        setYear(name ? yearToday(festivalDate(name)) : undefined);
        if (name === 'midautumn') setPhase('night');
        if (wx) weatherIn(wx);
        invalidate();
      },
      phase(v) {
        setPhase(v);
        invalidate();
      },
      moon(v) {
        if (v === undefined) return pv.age;
        pv.age = v;
        invalidate();
      },
      weather(v) {
        rainChosen = false;
        if (!v) return loadWeather().then(weatherIn);
        weatherIn({
          ...(wx || {
            temp: 12,
            unit: 'C',
            city: 'San Jose',
            latitude: 37.3,
            timeZone: 'America/Los_Angeles',
            sunrise: 400,
            sunset: 1020,
            windSpeed: 10,
            windFrom: 250
          }),
          condition: v
        });
      },
      wind(from, speed) {
        weatherIn({
          ...(wx || { condition: 'clear', temp: 12, unit: 'C', city: 'San Jose', latitude: 37.3, timeZone: 'America/Los_Angeles', sunrise: 400, sunset: 1020 }),
          windFrom: from,
          windSpeed: speed
        });
      },
      look(v) {
        setLook(v);
      },
      fireflies() {
        pv.fliesOn = true;
        setYear(11.2);
        setPhase('night');
        invalidate();
      },
      welcomeBack() {
        $('#hero').textContent = backGreeting();
        greetVisitor();
        invalidate();
      }
    })
  );
setInterval(() => document.hidden || loadWeather().then(weatherIn), 30 * 60_000);
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
  langBtn();
  alignSeg();
  document.fonts?.ready.then(alignSeg);
  if (lang === 'ja') loadType();
  if (zhOn) speak();
  setPhase('auto');
  showTerm();
  tick();
  census();
  setInterval(tick, 20000);
  if (glOK) glc.dataset.on = '';
  intro();
  panesLive();
  invalidate();
  {
    const [ch, at] = location.hash.slice(1).split('/');
    if (CHAPTERS[ch]) setTimeout(() => openSheet(ch, at), 1400);
  }
  let rt = 0;
  const refit = () => {
    clearTimeout(rt);
    rt = setTimeout(fit, 150);
  };
  addEventListener('resize', refit);
  // the pond can change size with no resize of the window (a phone's browser bars, an in-app browser's own)
  window.visualViewport?.addEventListener('resize', refit);
  if (window.ResizeObserver) new ResizeObserver(refit).observe(pond);
}
// the water, the glass and what is painted for the pond's size, fitted to the size it is now
function fit() {
  resize();
  panesLive();
  invalidate();
  paintInk();
  makePetals();
}
start();
