// Devot's dove and ocra's jumping spider as rendered sprite sheets (public/pond/water/), for the pond
// (engine.js): which frame a moment calls for, and how each look dresses the sheets. The sheets' grids and
// frame order are in docs/agents/pond.md ("Water").
/*
   A sheet is a grid of equal cells, the creature facing right in each, its place on the ground at the
   cell's centre, so the pond lays a cell where the creature is and turns it to its heading. A look's
   dress is made once from the neutral sheet, when the look first shows it, and kept: nothing is tinted
   in a frame. */

export const SHEETS = {
  // `half` is how many of the creature's own units a cell spans either side of its centre
  dove: { src: '/pond/water/dove.webp', cell: 256, half: 4 },
  spider: { src: '/pond/water/spider.webp', cell: 192, half: 2.7 }
};

const TAU = Math.PI * 2;
// while it looks about: mostly still, a turn of the head each way, and once a preen
const IDLE = [0, 0, 1, 0, 0, 2, 0, 3, 3, 0];
/** How long the take-off's six frames take, in seconds, before the flight's beat. */
export const TAKE_OFF = 0.45;
/** Below this height (0 on the pad, 1 in full flight) an arriving dove is landing. */
export const LANDING = 0.45;

/**
 * The dove's cell, as [row, column].
 * `state` is 'in', 'sit' or 'out'; `t` the seconds in that state; `h` its height (0 on the pad to 1);
 * `ph` the wing-beat's phase in radians; `idle` whether it has drunk and is looking about.
 */
export function doveFrame({ state, t, h, ph, idle = false }) {
  if (state === 'sit') {
    // the landing's last two frames as it folds up, then sitting
    if (t < 0.12) return [3, 4];
    if (t < 0.26) return [3, 5];
    return [0, idle ? IDLE[Math.floor(t / 0.9) % IDLE.length] : 0];
  }
  if (state === 'out' && t < TAKE_OFF) return [1, Math.min(5, Math.floor((t / TAKE_OFF) * 6))];
  if (state === 'in' && h < LANDING) return [3, Math.min(3, Math.floor((1 - h / LANDING) * 4))];
  // one beat a turn of the phase, the wings widest where the phase's sine peaks (the shadow follows that)
  const beat = (((ph / TAU) % 1) + 1) % 1;
  return [2, Math.floor(beat * 8 + 0.5) % 8];
}

/**
 * The spider's cell, as [row, column].
 * `state` is 'sit', 'walk', 'crouch' or 'jump'; `t` the seconds in that state; `crouch` and `jump` run 0
 * to 1; `gone` is how far it has walked, in strides (one loop of the walk is one stride); `alert` whether
 * something nearby has its eye.
 */
export function spiderFrame({ state, t, crouch, jump, gone = 0, alert = false }) {
  if (state === 'walk') return [1, Math.floor((((gone % 1) + 1) % 1) * 8) % 8];
  if (state === 'crouch') return [2, crouch > 0.5 ? 1 : 0];
  if (state === 'jump') return [3, Math.min(2, Math.floor(jump * 3))];
  // just landed: splayed for a moment, then still; looking up when something has its eye
  if (t < 0.18) return [3, 3];
  return [0, alert ? 1 : 0];
}

// How each look dresses them. `flat` fills the shape with one colour; `mul` tints the rendering; `tones`
// cuts its shading to that many flat steps; `line` puts a key line round the shape; `hollow` leaves only
// that much of the body inside the line. The water (and any look not named) keeps the rendering as it is,
// in the light of the time of day.
const DRESS = {
  ink: { flat: '#221e1a' },
  ukiyo: { mul: '#f6edd8', tones: 3, line: '#0c1b27' },
  glow: { flat: '#4ff5e6' },
  blueprint: { flat: '#e8f3ff', line: '#e8f3ff', hollow: 0.14 },
  ascii: { flat: '#cfe6df' },
  qinghua: { mul: '#a9bde6', line: '#1f3f8f' },
  dunhuang: { mul: '#ede0c2', line: '#2e1c12' },
  stars: { flat: '#c9d4f0', line: '#c9d4f0', hollow: 0.18 }
};
/** Whether a look keeps the rendering's own light (and so the ground's soft shadow under it). */
export const lit = (look) => !DRESS[look] || look === 'ukiyo';

const blank = (img) => {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  return cv;
};
// the sheet's shapes filled with one colour
function filled(img, colour) {
  const cv = blank(img),
    c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = colour;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
// the sheet multiplied by a colour, its own alpha kept
function tinted(img, colour) {
  const cv = blank(img),
    c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = colour;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(img, 0, 0);
  return cv;
}
/**
 * A sheet dressed for a look, as a canvas of the same size. `light` is the colour the time of day gives
 * (a CSS colour), used where the look keeps the rendering.
 */
export function dressed(img, look, light = '#fff') {
  const d = DRESS[look];
  if (!d) return tinted(img, light);
  const body = d.flat ? filled(img, d.flat) : tinted(img, d.mul),
    c = body.getContext('2d');
  if (d.tones) {
    const px = c.getImageData(0, 0, body.width, body.height),
      a = px.data,
      n = d.tones - 1;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      // one step for the whole pixel, from its lightness, so a tone stays one colour
      const l = Math.max(a[i], a[i + 1], a[i + 2]) || 1,
        k = (Math.round((l / 255) * n) / n) * (255 / l);
      a[i] = Math.min(255, a[i] * k);
      a[i + 1] = Math.min(255, a[i + 1] * k);
      a[i + 2] = Math.min(255, a[i + 2] * k);
    }
    c.putImageData(px, 0, 0);
  }
  if (d.hollow != null) {
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = `rgba(0,0,0,${d.hollow})`;
    c.fillRect(0, 0, body.width, body.height);
  }
  if (d.line) {
    // the shape grown by the line's width, with the shape itself cut out where the body is to stay hollow
    const ring = blank(img),
      r = ring.getContext('2d'),
      ink = filled(img, d.line),
      w = Math.max(1.5, img.height / 400);
    for (let i = 0; i < 8; i++) r.drawImage(ink, Math.cos((i / 8) * TAU) * w, Math.sin((i / 8) * TAU) * w);
    if (d.hollow != null) {
      r.globalCompositeOperation = 'destination-out';
      r.drawImage(img, 0, 0);
    }
    c.globalCompositeOperation = 'destination-over';
    c.drawImage(ring, 0, 0);
  }
  return body;
}

const fetched = (src) =>
  new Promise((done, fail) => {
    const im = new Image();
    im.onload = () => done(im);
    im.onerror = () => fail(new Error(`no picture at ${src}`));
    im.src = src;
  });
/**
 * Both sheets, fetched; then `pic(which, look, light)` gives a sheet dressed for the look, made the first
 * time it is asked for and again only when the look or the light changes.
 */
export async function loadSprites() {
  const [dove, spider] = await Promise.all([fetched(SHEETS.dove.src), fetched(SHEETS.spider.src)]),
    img = { dove, spider },
    kept = { dove: null, spider: null };
  return {
    pic(which, look, light) {
      const key = lit(look) && look !== 'ukiyo' ? `${look} ${light}` : look,
        k = kept[which];
      if (k && k.key === key) return k.cv;
      kept[which] = { key, cv: dressed(img[which], look, light) };
      return kept[which].cv;
    }
  };
}
