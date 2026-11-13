// Devot's dove and ocra's jumping spider as rendered sprite sheets (public/pond/water/), for the pond
// (engine.js): which frame a moment calls for, and how each look dresses the sheets. The sheets' grids and
// frame order are in docs/agents/pond.md ("Water").
/*
   A sheet is rows of equal cells, the creature facing right in each, its place on the ground at the
   cell's centre, so the pond lays a cell where the creature is and turns it to its heading. A sheet
   comes as several files (its rows in order, left-aligned, the rest of each row empty), and is packed
   here into one picture without the empty cells. A look's dress is made once from that picture, when
   the look first shows it, and kept: nothing is tinted in a frame. */

export const SHEETS = {
  // `rows` is how many frames each row played holds (the dove's sheet ends with a walk the pond has no
  // use for, which is left out); `half` is how many of the creature's own units a cell spans either
  // side of its centre
  dove: {
    files: ['/pond/water/dove-v2-1.webp', '/pond/water/dove-v2-2.webp', '/pond/water/dove-v2-3.webp'],
    cell: 384,
    half: 4,
    rows: [5, 6, 12, 6]
  },
  spider: {
    files: ['/pond/water/spider-v2-1.webp', '/pond/water/spider-v2-2.webp', '/pond/water/spider-v2-3.webp'],
    cell: 384,
    half: 2.7,
    rows: [4, 8, 2, 4]
  }
};
// how many cells across the packed picture is
const ACROSS = 6;
/** Where a frame's cell is in a creature's packed picture, as [x, y] in pixels. */
export function frameAt(which, row, i) {
  const { cell, rows } = SHEETS[which];
  let n = i;
  for (let r = 0; r < row; r++) n += rows[r];
  return [(n % ACROSS) * cell, Math.floor(n / ACROSS) * cell];
}

const TAU = Math.PI * 2;
// while it looks about: mostly still, a turn of the head each way, a bob, and once a preen
const IDLE = [0, 0, 1, 0, 4, 0, 2, 0, 3, 3, 0];
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
  // one beat a turn of the phase, the wings widest (the fifth and sixth frames) where the phase's sine
  // peaks (the shadow follows that)
  const beat = (((ph / TAU) % 1) + 1) % 1;
  return [2, Math.floor(beat * 12 + 2) % 12];
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
  stars: { flat: '#c9d4f0', line: '#c9d4f0', hollow: 0.18 },
  relief: { mul: '#d8cfbd', line: '#4a3d31' }
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
 * (a CSS colour), used where the look keeps the rendering; `cell` the size of the sheet's cells, which
 * a key line's width goes by.
 */
export function dressed(img, look, light = '#fff', cell = 256) {
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
      w = Math.max(1.5, cell / 100);
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
// a creature's files as one picture: the frames played, in order, six across
async function packed(which) {
  const { files, cell, rows } = SHEETS[which],
    ims = await Promise.all(files.map(fetched)),
    cv = document.createElement('canvas'),
    c = cv.getContext('2d');
  cv.width = ACROSS * cell;
  cv.height = Math.ceil(rows.reduce((a, b) => a + b, 0) / ACROSS) * cell;
  let row = 0;
  for (const im of ims)
    for (let y = 0; y < im.height && row < rows.length; y += cell, row++)
      for (let i = 0; i < rows[row]; i++) c.drawImage(im, i * cell, y, cell, cell, ...frameAt(which, row, i), cell, cell);
  return cv;
}
/**
 * `pic(which, look, light)` gives a creature's sheet dressed for the look, or null until the sheet has
 * come: it is fetched the first time it is asked for (and `changed` is called when it arrives), dressed
 * the first time a look asks, and again only when the look or the light changes.
 */
export function spritePics(changed) {
  const img = { dove: null, spider: null },
    asked = { dove: false, spider: false },
    kept = { dove: null, spider: null };
  return (which, look, light) => {
    if (!img[which]) {
      if (!asked[which]) {
        asked[which] = true;
        packed(which).then(
          (im) => {
            img[which] = im;
            changed();
          },
          // (without its sheet the creature is simply not drawn)
          () => {}
        );
      }
      return null;
    }
    const key = lit(look) && look !== 'ukiyo' ? `${look} ${light}` : look,
      k = kept[which];
    if (k && k.key === key) return k.cv;
    kept[which] = { key, cv: dressed(img[which], look, light, SHEETS[which].cell) };
    return kept[which].cv;
  };
}
