// What the left screen shows: a places window with a map of the United States, drawn on a canvas
// that main.js puts on the screen's glass. Visited states (places.json) are lit in the lamp's
// amber and can be pressed; a pressed state brings in a panel for its photographs.
//
// The canvas is drawn again only when something changes (hover, opening, closing, a photo
// arriving); main.js asks update() once a frame and uploads the sheet it hands back.
// Everything is laid out in canvas pixels on a 2560 x 1440 sheet, with type sized to stay
// readable when the whole screen is some 500 pixels wide in the seat view.
//
// There are two sheets. What stands still is drawn on the full one. While the panel slides
// (0.4 s) each frame goes to a second sheet of half the size, a quarter of the pixels to fill
// and to send to the graphics card; the last frame is drawn on the full sheet again. What never
// changes (wallpaper, window, title bar) is drawn once per sheet and copied under each frame.

const W = 2560,
  H = 1440;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MENU = 46; // the desktop's own strip along the top, as on the screen beside this one
const RIM = [22, 18, 24]; // the wallpaper left showing beside, above and below the window
const WIN = {
  x: RIM[0],
  y: MENU + RIM[1],
  w: W - RIM[0] * 2,
  h: H - MENU - RIM[1] - RIM[2],
  r: 26,
  bar: 104
};
const SIDE = 690; // the list of places, on the window's right
const PANEL = 1500; // the photo panel, which slides in over the list and the map's right half
const BODY = { x: WIN.x, y: WIN.y + WIN.bar, w: WIN.w, h: WIN.h - WIN.bar };
const MAP_AREA = { x: BODY.x, y: BODY.y, w: BODY.w - SIDE, h: BODY.h };
const FOCUS_AREA = { x: BODY.x, y: BODY.y, w: BODY.w - PANEL, h: BODY.h };
const CLOSE = { x: WIN.x + WIN.w - 124, y: BODY.y + 112, r: 50 };
const ROW = { x: WIN.x + WIN.w - SIDE, y: BODY.y + 190, h: 100 };
const OPEN_SECONDS = 0.42;
const MOTION_SCALE = 0.5; // the size of the sheet the slide is drawn on
const MAP_DROP = 26; // the map sits a little low in its area, for the label above the north-west
const INSETS = ['AK', 'HI']; // drawn below the south-west, not where they are

const COLOR = {
  window: '#10141b',
  bar: '#1b202a',
  hairline: 'rgba(255, 255, 255, 0.10)',
  land: '#232b39',
  border: '#3d4859',
  // the land and its borders beside an open state: lifted a little, so the neighbours stay a map
  landQuiet: '#2b3546',
  borderQuiet: '#56637a',
  visited: '#c98443',
  // The screen glows and the page's tone curve (AgX) pulls bright colours toward white, so a
  // lighter amber comes out cream. The hover is brighter mostly in red and keeps its blue low:
  // more saturated on the canvas than it should look, and amber once it is through the curve.
  hover: '#ff8206',
  visitedBorder: '#ffca7a',
  text: '#e9e4da',
  muted: '#8f97a6',
  faint: '#5b6474',
  panel: '#161b24',
  slot: '#1d232e',
  dot: '#fff3df',
  tag: 'rgba(12, 15, 20, 0.9)',
  tagEdge: 'rgba(255, 255, 255, 0.16)'
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** A colour between two '#rrggbb' ones. */
const blend = (a, b, t) => {
  const x = rgb(a),
    y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], t))).join(',')})`;
};

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The desk's wallpaper behind the window: the calm navy of the offline render. */
function wallpaper(g) {
  const srgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  const stops = [
    [0.02, 0.052, 0.165],
    [0.006, 0.016, 0.06]
  ];
  g.save();
  g.scale(W, H);
  // brightest behind the window, where it is hidden: only the dim outer part shows around it
  const grad = g.createRadialGradient(0.5, 0.45, 0, 0.5, 0.45, 0.62);
  // the ramp is linear in light, so place a few stops for the sRGB canvas to follow it
  for (let i = 0; i <= 8; i++) {
    const rgb = stops[0].map((a, k) => a + (stops[1][k] - a) * (i / 8));
    grad.addColorStop(i / 8, `rgb(${rgb.map(srgb).join(',')})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, 1);
  g.restore();
}

/**
 * Makes the screen. `map` is us-map.json (build-map.mjs), `places` is places.json.
 * Returns the canvas and what main.js needs to drive it.
 */
export function createMapScreen(map, places) {
  // a sheet: a canvas of the layout's W x H at some scale, and what never changes on it
  const sheet = (k) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return { canvas, g: ctx, still: null };
  };
  const full = sheet(1),
    motion = sheet(MOTION_SCALE);
  const canvas = full.canvas;
  let g = full.g; // the sheet being drawn on
  const probe = document.createElement('canvas').getContext('2d'); // for hit tests, never transformed

  const states = Object.entries(map.states).map(([id, s]) => ({
    id,
    ...s,
    path: new Path2D(s.d),
    place: null
  }));
  const byId = Object.fromEntries(states.map((s) => [s.id, s]));
  const visited = [];
  for (const place of places.places) {
    const s = byId[place.state];
    if (!s) continue;
    s.place = place;
    // label: how far from the dot the name's pill starts, in sheet pixels with the map at rest
    s.city =
      place.city && map.cities[s.id]
        ? {
            name: place.city,
            at: map.cities[s.id],
            offset: Array.isArray(place.label) ? place.label : [30, 0]
          }
        : null;
    visited.push(s);
  }

  // the whole country, fitted in the map's part of the window
  const fit = Math.min((MAP_AREA.w - 90) / map.width, (MAP_AREA.h - 90) / map.height);
  const home = {
    s: fit,
    x: MAP_AREA.x + (MAP_AREA.w - map.width * fit) / 2,
    y: MAP_AREA.y + (MAP_AREA.h - map.height * fit) / 2 + MAP_DROP
  };

  /** Where the map sits when a state is open: that state, large, in what the panel leaves free. */
  function focusOn(s) {
    const [x0, y0, x1, y1] = s.box;
    const k = Math.min((FOCUS_AREA.w - 200) / (x1 - x0), (FOCUS_AREA.h - 360) / (y1 - y0), fit * 3);
    return {
      s: k,
      x: FOCUS_AREA.x + FOCUS_AREA.w / 2 - ((x0 + x1) / 2) * k,
      y: FOCUS_AREA.y + FOCUS_AREA.h / 2 - ((y0 + y1) / 2) * k
    };
  }

  const ui = {
    hover: null,
    hoverClose: false,
    open: null,
    shown: null,
    t: 0,
    from: 0,
    to: 0,
    started: 0,
    moving: false,
    stale: true
  };
  const images = new Map(); // photo url -> Image, once asked for
  let draws = 0, // how often a sheet was drawn, for the console and the tests
    motionDraws = 0;

  function photo(entry) {
    const src = typeof entry === 'string' ? entry : entry.src;
    let img = images.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous'; // or the canvas could not be a texture any more
      img.onload = () => {
        ui.stale = true;
      };
      img.src = src;
      images.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  // -------------------------------------------------------------------------------------------
  // Drawing.
  // -------------------------------------------------------------------------------------------

  const TAG = 46; // the size of a label's type

  /** A name in a dark pill. `side` says which part of the pill (x, y) is: its left or right end, its top or bottom middle, or its centre. */
  function tag(text, x, y, side) {
    g.font = `600 ${TAG}px ${FONT}`;
    const w = g.measureText(text).width + TAG * 0.9,
      h = TAG * 1.5;
    const left = side === 'left' ? x : side === 'right' ? x - w : x - w / 2;
    const top = side === 'top' ? y : side === 'bottom' ? y - h : y - h / 2;
    roundRect(g, left, top, w, h, h / 2);
    g.fillStyle = COLOR.tag;
    g.fill();
    g.strokeStyle = COLOR.tagEdge;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = COLOR.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, left + w / 2, top + h / 2 + TAG * 0.04);
  }

  /**
   * A city: its dot where the city is, and its name off to one side at the end of a thin line, so
   * the name covers neither its own state nor another label. With the state open and large the
   * line shortens to a stub, and the name changes sides rather than run under the panel.
   */
  function drawCity(city, x, y, t) {
    let [dx, dy] = city.offset;
    const beside = Math.abs(dx) >= Math.abs(dy);
    if (t > 0) {
      const len = Math.hypot(dx, dy),
        short = Math.min(len, 44);
      dx = mix(dx, (dx / len) * short, t);
      dy = mix(dy, (dy / len) * short, t);
      g.font = `600 ${TAG}px ${FONT}`;
      const w = g.measureText(city.name).width + TAG * 0.9;
      const edge = mix(BODY.x + BODY.w - SIDE, FOCUS_AREA.x + FOCUS_AREA.w, t) - 40;
      if (beside && dx > 0 && x + dx + w > edge) dx = -dx;
    }
    const ax = x + dx,
      ay = y + dy;
    g.lineCap = 'round';
    for (const [width, colour] of [
      [9, COLOR.window],
      [3.5, COLOR.dot]
    ]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(ax, ay);
      g.lineWidth = width;
      g.strokeStyle = colour;
      g.stroke();
    }
    g.lineCap = 'butt';
    g.beginPath();
    g.arc(x, y, 15, 0, Math.PI * 2);
    g.fillStyle = COLOR.window;
    g.fill();
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fillStyle = COLOR.dot;
    g.fill();
    tag(city.name, ax, ay, beside ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'top' : 'bottom');
  }

  function drawMap(t) {
    const focus = ui.shown ? focusOn(ui.shown) : home;
    const at = {
      s: mix(home.s, focus.s, t),
      x: mix(home.x, focus.x, t),
      y: mix(home.y, focus.y, t)
    };
    // How much of a state is left with another one open. The two insets are not where their
    // states are, so they go rather than slide into the open state's view; and with an inset
    // open, everything else goes.
    const inset = (s) => INSETS.includes(s.id);
    const left = (s) => (!ui.shown || s === ui.shown ? 1 : inset(s) || inset(ui.shown) ? 1 - t : 1);
    g.save();
    g.beginPath();
    g.rect(BODY.x, BODY.y, BODY.w, BODY.h);
    g.clip();
    g.save();
    g.translate(at.x, at.y);
    g.scale(at.s, at.s);
    g.lineJoin = 'round';
    g.lineWidth = 2.5 / at.s;
    const land = blend(COLOR.land, COLOR.landQuiet, t);
    g.fillStyle = land;
    g.strokeStyle = blend(COLOR.border, COLOR.borderQuiet, t);
    for (const s of states) {
      if (s.place) continue;
      g.globalAlpha = left(s);
      g.fill(s.path);
      g.stroke(s.path);
    }
    for (const s of visited) {
      const lit = s === ui.hover && !ui.open;
      const quiet = ui.shown && s !== ui.shown ? t : 0;
      g.globalAlpha = left(s);
      if (quiet) {
        // the other visited states keep a trace of their amber on the land's own colour
        g.fillStyle = land;
        g.fill(s.path);
        g.globalAlpha *= 1 - 0.62 * quiet;
      }
      g.fillStyle = lit ? COLOR.hover : COLOR.visited;
      g.fill(s.path);
      g.globalAlpha = left(s);
      g.strokeStyle = COLOR.window;
      g.lineWidth = 3 / at.s;
      g.stroke(s.path);
    }
    g.globalAlpha = 1;
    if (ui.hover && !ui.open) {
      g.strokeStyle = COLOR.visitedBorder;
      g.lineWidth = 5 / at.s;
      g.stroke(ui.hover.path);
    }
    g.restore();

    const px = (p) => [at.x + p[0] * at.s, at.y + p[1] * at.s];
    for (const s of visited) {
      if (!s.city) continue;
      const alpha = ui.shown && s !== ui.shown ? 1 - t : 1;
      if (alpha <= 0.01) continue;
      g.globalAlpha = alpha;
      const [x, y] = px(s.city.at);
      drawCity(s.city, x, y, s === ui.shown ? t : 0);
      g.globalAlpha = 1;
    }
    // a state without a city says its name while the pointer is on it
    if (ui.hover && !ui.open && !ui.hover.city) {
      const [x, y] = px(ui.hover.centre);
      tag(ui.hover.name, x, y, 'centre');
    }
    g.restore();
  }

  function drawList() {
    const x = ROW.x;
    g.fillStyle = COLOR.bar;
    g.fillRect(x, BODY.y, SIDE, BODY.h);
    g.fillStyle = COLOR.hairline;
    g.fillRect(x, BODY.y, 3, BODY.h);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = COLOR.text;
    g.font = `650 58px ${FONT}`;
    g.fillText('Visited', x + 60, BODY.y + 108);
    g.textAlign = 'right';
    g.fillStyle = COLOR.muted;
    g.font = `500 42px ${FONT}`;
    g.fillText(`${visited.length} states`, x + SIDE - 60, BODY.y + 106);
    g.fillStyle = COLOR.hairline;
    g.fillRect(x + 60, BODY.y + 156, SIDE - 120, 3);
    visited.forEach((s, i) => {
      const y = ROW.y + i * ROW.h;
      if (s === ui.hover) {
        roundRect(g, x + 28, y + 6, SIDE - 56, ROW.h - 12, 22);
        g.fillStyle = 'rgba(255, 255, 255, 0.07)';
        g.fill();
      }
      g.beginPath();
      g.arc(x + 78, y + ROW.h / 2, 13, 0, Math.PI * 2);
      g.fillStyle = s === ui.hover ? COLOR.hover : COLOR.visited;
      g.fill();
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillStyle = COLOR.text;
      g.font = `550 48px ${FONT}`;
      g.fillText(s.name, x + 116, y + ROW.h / 2 + 2);
      if (s.city) {
        g.textAlign = 'right';
        g.fillStyle = COLOR.muted;
        g.font = `450 39px ${FONT}`;
        g.fillText(s.city.name, x + SIDE - 60, y + ROW.h / 2 + 2);
      }
    });
  }

  function drawSlot(x, y, w, h, entry) {
    roundRect(g, x, y, w, h, 20);
    const img = entry && photo(entry);
    if (img) {
      g.save();
      g.clip();
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      g.drawImage(img, x + (w - img.naturalWidth * k) / 2, y + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
      g.restore();
      return;
    }
    g.fillStyle = COLOR.slot;
    g.fill();
    g.setLineDash([18, 14]);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    g.stroke();
    g.setLineDash([]);
    // a small picture mark: a frame, a hill, a sun
    const cx = x + w / 2,
      cy = y + h / 2;
    g.strokeStyle = COLOR.faint;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    roundRect(g, cx - 46, cy - 34, 92, 68, 10);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 34, cy + 22);
    g.lineTo(cx - 8, cy - 6);
    g.lineTo(cx + 8, cy + 10);
    g.lineTo(cx + 18, cy);
    g.lineTo(cx + 34, cy + 22);
    g.stroke();
    g.beginPath();
    g.arc(cx + 22, cy - 16, 6, 0, Math.PI * 2);
    g.fillStyle = COLOR.faint;
    g.fill();
  }

  function drawPanel(t) {
    const s = ui.shown;
    const x = WIN.x + WIN.w - PANEL * t;
    g.save();
    g.beginPath();
    g.rect(BODY.x, BODY.y, BODY.w, BODY.h);
    g.clip();
    const shade = g.createLinearGradient(x - 90, 0, x, 0);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    g.fillStyle = shade;
    g.fillRect(x - 90, BODY.y, 90, BODY.h);
    g.fillStyle = COLOR.panel;
    g.fillRect(x, BODY.y, PANEL, BODY.h);
    g.fillStyle = COLOR.hairline;
    g.fillRect(x, BODY.y, 3, BODY.h);

    const pad = 84,
      left = x + pad,
      inner = PANEL - pad * 2;
    const photos = s.place.photos || [];
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = COLOR.text;
    g.font = `650 104px ${FONT}`;
    g.fillText(s.name, left, BODY.y + 172);
    // the city, with the dot it has on the map
    const lineY = BODY.y + 262;
    let tx = left;
    if (s.city) {
      g.beginPath();
      g.arc(left + 14, lineY - 16, 13, 0, Math.PI * 2);
      g.fillStyle = COLOR.visited;
      g.fill();
      tx = left + 46;
    }
    g.fillStyle = COLOR.muted;
    g.font = `500 50px ${FONT}`;
    const count = photos.length === 1 ? '1 photo' : photos.length ? `${photos.length} photos` : '';
    g.fillText([s.city && s.city.name, count].filter(Boolean).join('  ·  '), tx, lineY);

    // close
    const cx = x + PANEL - 124,
      cy = CLOSE.y;
    g.beginPath();
    g.arc(cx, cy, CLOSE.r, 0, Math.PI * 2);
    g.fillStyle = ui.hoverClose ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.09)';
    g.fill();
    g.strokeStyle = ui.hoverClose ? COLOR.text : COLOR.muted;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 17, cy - 17);
    g.lineTo(cx + 17, cy + 17);
    g.moveTo(cx + 17, cy - 17);
    g.lineTo(cx - 17, cy + 17);
    g.stroke();
    g.lineCap = 'butt';

    // the photographs: three across, two down
    const gap = 36,
      cols = 3,
      rows = 2,
      top = BODY.y + 340;
    const w = (inner - gap * (cols - 1)) / cols,
      h = 318;
    for (let i = 0; i < cols * rows; i++) {
      const sx = left + (i % cols) * (w + gap),
        sy = top + Math.floor(i / cols) * (h + gap);
      drawSlot(sx, sy, w, h, photos[i]);
      if (i === cols * rows - 1 && photos.length > cols * rows) {
        roundRect(g, sx, sy, w, h, 20);
        g.fillStyle = 'rgba(10, 12, 16, 0.6)';
        g.fill();
        g.fillStyle = COLOR.text;
        g.font = `600 64px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`+${photos.length - cols * rows + 1}`, sx + w / 2, sy + h / 2);
      }
    }
    if (!photos.length) {
      g.fillStyle = COLOR.muted;
      g.font = `italic 450 46px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText('photos to come', x + PANEL / 2, top + rows * h + gap + 116);
    }
    g.restore();
  }

  /** What never changes: the wallpaper, the menu strip, the window and its title bar. */
  function drawStill() {
    wallpaper(g);
    g.fillStyle = 'rgba(6, 8, 14, 0.55)';
    g.fillRect(0, 0, W, MENU);
    g.fillStyle = 'rgba(255, 255, 255, 0.42)';
    [
      [36, 30],
      [96, 84],
      [204, 60],
      [288, 72],
      [384, 52],
      [W - 300, 36],
      [W - 240, 36],
      [W - 180, 36],
      [W - 120, 84]
    ].forEach(([x, w]) => {
      roundRect(g, x, MENU / 2 - 7, w, 14, 7);
      g.fill();
    });
    // the window, with a soft shadow on the wallpaper
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, 0.6)';
    g.shadowBlur = 28;
    g.shadowOffsetY = 8;
    roundRect(g, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
    g.fillStyle = COLOR.window;
    g.fill();
    g.restore();
    g.save();
    roundRect(g, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
    g.clip();
    g.fillStyle = COLOR.bar;
    g.fillRect(WIN.x, WIN.y, WIN.w, WIN.bar);
    ['#d9695f', '#d9a94a', '#6fae62'].forEach((c, i) => {
      g.beginPath();
      g.arc(WIN.x + 62 + i * 58, WIN.y + WIN.bar / 2, 17, 0, Math.PI * 2);
      g.fillStyle = c;
      g.fill();
    });
    g.fillStyle = COLOR.text;
    g.font = `600 46px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Places', WIN.x + WIN.w / 2, WIN.y + WIN.bar / 2 + 2);
    g.fillStyle = COLOR.hairline;
    g.fillRect(WIN.x, WIN.y + WIN.bar - 3, WIN.w, 3);
    g.restore();
  }

  function draw(on = full) {
    draws++;
    if (on === motion) motionDraws++;
    g = on.g;
    if (!on.still) {
      // once per sheet, at the sheet's own size
      on.still = document.createElement('canvas');
      on.still.width = on.canvas.width;
      on.still.height = on.canvas.height;
      const keep = g;
      g = on.still.getContext('2d');
      g.setTransform(keep.getTransform());
      drawStill();
      g = keep;
    }
    g.drawImage(on.still, 0, 0, W, H);
    const t = ease(ui.t);
    g.save();
    roundRect(g, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
    g.clip();
    if (t < 1) drawList();
    drawMap(t);
    if (t > 0 && ui.shown) drawPanel(t);
    g.restore();
    roundRect(g, WIN.x + 1.5, WIN.y + 1.5, WIN.w - 3, WIN.h - 3, WIN.r);
    g.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    g.lineWidth = 3;
    g.stroke();
    return on.canvas;
  }

  // -------------------------------------------------------------------------------------------
  // What is under a point of the canvas, and what a press there does.
  // -------------------------------------------------------------------------------------------

  /** `{ kind: 'state', state }` (a visited state or its row), `{ kind: 'close' }`, `{ kind: 'panel' }`, `{ kind: 'aside' }` or null. */
  function hit(x, y) {
    if (x < BODY.x || x > BODY.x + BODY.w || y < BODY.y || y > BODY.y + BODY.h) return null;
    if (ui.open) {
      if (Math.hypot(x - CLOSE.x, y - CLOSE.y) < CLOSE.r + 22) return { kind: 'close' };
      return x > WIN.x + WIN.w - PANEL ? { kind: 'panel' } : { kind: 'aside' };
    }
    if (ui.moving) return null;
    if (x > ROW.x) {
      const s = visited[Math.floor((y - ROW.y) / ROW.h)];
      return s && y >= ROW.y ? { kind: 'state', state: s.id } : null;
    }
    const mx = (x - home.x) / home.s,
      my = (y - home.y) / home.s;
    for (const s of visited) {
      if (mx < s.box[0] || mx > s.box[2] || my < s.box[1] || my > s.box[3]) continue;
      if (probe.isPointInPath(s.path, mx, my)) return { kind: 'state', state: s.id };
    }
    return null;
  }

  /** Tells the screen what the pointer is over (a result of hit(), or null). True when that should show a hand. */
  function point(h) {
    const hover = h && h.kind === 'state' ? byId[h.state] : null;
    const hoverClose = !!h && h.kind === 'close';
    if (hover !== ui.hover || hoverClose !== ui.hoverClose) {
      ui.hover = hover;
      ui.hoverClose = hoverClose;
      ui.stale = true;
    }
    return !!hover || hoverClose;
  }

  function go(to, now = performance.now()) {
    ui.from = ui.t;
    ui.to = to;
    ui.started = now;
    ui.moving = true;
    ui.stale = true;
  }

  function open(id) {
    const s = byId[String(id).toUpperCase()];
    if (!s || !s.place) return false;
    ui.open = ui.shown = s;
    ui.hover = null;
    go(1);
    return true;
  }

  function close() {
    if (!ui.open) return false;
    ui.open = null;
    ui.hoverClose = false;
    go(0);
    return true;
  }

  /** A press at a hit() result. True when it did something. */
  function press(h) {
    if (!h) return false;
    if (h.kind === 'state') return open(h.state);
    if (h.kind === 'close' || h.kind === 'aside') return close();
    return false;
  }

  /**
   * Once a frame. Draws if anything changed and hands back the sheet it drew on (the full canvas,
   * or `motion` for a frame of the slide), or null when nothing changed.
   */
  function update(now) {
    if (ui.moving) {
      const k = Math.min((now - ui.started) / (OPEN_SECONDS * 1000), 1);
      ui.t = mix(ui.from, ui.to, k);
      if (k >= 1) {
        ui.moving = false;
        ui.t = ui.to;
        if (!ui.open) ui.shown = null;
      }
      ui.stale = true;
    }
    if (!ui.stale) return null;
    ui.stale = false;
    return draw(ui.moving ? motion : full); // the slide's last frame is already at rest: in full
  }

  /** Where a state's middle is on the canvas with the map at rest, as 0..1 across and down. */
  function where(id) {
    const s = byId[String(id).toUpperCase()];
    return s ? [(home.x + s.centre[0] * home.s) / W, (home.y + s.centre[1] * home.s) / H] : null;
  }

  draw();
  ui.stale = false;
  return {
    canvas,
    motion: motion.canvas,
    width: W,
    height: H,
    hit,
    point,
    press,
    open,
    close,
    update,
    where,
    get opened() {
      return ui.open ? ui.open.id : null;
    },
    get hovered() {
      return ui.hover ? ui.hover.id : null;
    },
    get settled() {
      return !ui.moving;
    },
    get draws() {
      return draws;
    },
    /** How many of those went to the small sheet. */
    get motionDraws() {
      return motionDraws;
    }
  };
}
