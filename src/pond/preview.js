// The pond's later details: the real moon's phase, the wind, the festivals, fireflies on summer nights,
// stars on clear nights, a welcome back, and quiet ambience. They are part of the pond. What is only for
// trying things is the small panel that forces each state: it shows with ?preview in the address, or in a
// build with PUBLIC_POND_PREVIEW=1 (as the single-file demo is).

export const PANEL = (typeof location !== 'undefined' && /[?&]preview\b/.test(location.search)) || !!import.meta.env.PUBLIC_POND_PREVIEW;

/** How far through its month the moon is: 0 new, 0.5 full (from a known new moon, 2000-01-06 18:14 UTC). */
export function moonAge(d = new Date()) {
  const P = 29.530588853,
    days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return (((days % P) + P) % P) / P;
}
/** How much of the moon is lit, 0 to 1. */
export const moonLit = (age) => (1 - Math.cos(age * 2 * Math.PI)) / 2;

// The festivals by date, 2026 to 2030: the lunar ones from the calendar's own tables, Qingming by the sun.
const FEST = {
  spring: ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'],
  qingming: ['2026-04-05', '2027-04-05', '2028-04-04', '2029-04-04', '2030-04-05'],
  dragon: ['2026-06-19', '2027-06-09', '2028-05-28', '2029-06-16', '2030-06-05'],
  midautumn: ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12']
};
// how many days each one is kept: the Spring Festival runs from its eve through the third day
const SPAN = { spring: [-1, 3], qingming: [0, 1], dragon: [-1, 1], midautumn: [-1, 1] };
/** The festival on a date, if any. */
export function festivalOn(d = new Date()) {
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
  for (const [name, dates] of Object.entries(FEST))
    for (const iso of dates) {
      const [y, m, dd] = iso.split('-').map(Number),
        at = Date.UTC(y, m - 1, dd) / 864e5;
      if (day - at >= SPAN[name][0] && day - at <= SPAN[name][1]) return name;
    }
  return null;
}
/** A date for each festival, this year's or the next one's, to show it. */
export function festivalDate(name, now = new Date()) {
  const next = FEST[name].map((s) => new Date(`${s}T12:00:00`)).find((d) => d.getTime() > now.getTime() - 4 * 864e5);
  return next || new Date(`${FEST[name][0]}T12:00:00`);
}

/** Welcome back, for a visitor who has been before. */
export const WELCOME_BACK = {
  en: ['Welcome back.', 'Good to see you again.', 'You came back.', 'Back at the pond.'],
  zh: ['欢迎回来。', '又见面了。', '你回来啦。', '又来池塘了。'],
  ja: ['おかえりなさい。', 'また会えましたね。', 'また来てくれたんですね。']
};
/** Counts this visit; true if there was one before (a day or an hour apart, it still counts). */
export function returning() {
  try {
    const n = Number(localStorage.getItem('pond-visits') || 0);
    localStorage.setItem('pond-visits', String(n + 1));
    return n > 0;
  } catch {
    return false;
  }
}

/**
 * The panel: a small glass card in the top left corner, folded to one button, that forces each state.
 * `api` is what the engine lends it.
 */
export function panel(api) {
  const el = document.createElement('aside');
  el.className = 'preview';
  el.setAttribute('aria-label', 'Preview');
  const row = (label, html) => `<label><span>${label}</span>${html}</label>`,
    sel = (id, opts) => `<select data-k="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
  el.innerHTML = `<button class="pv-tog" aria-expanded="false">Preview</button><div class="pv-body" hidden>
    ${row(
      'Date',
      sel('fest', [
        ['', 'Today'],
        ['spring', 'Spring Festival'],
        ['qingming', 'Qingming'],
        ['dragon', 'Dragon Boat'],
        ['midautumn', 'Mid-Autumn']
      ])
    )}
    ${row(
      'Time',
      sel('phase', [
        ['auto', 'Now'],
        ['dawn', 'Dawn'],
        ['day', 'Day'],
        ['dusk', 'Dusk'],
        ['night', 'Night']
      ])
    )}
    ${row('Moon', '<input type="range" data-k="moon" min="0" max="1" step="0.01">')}
    ${row(
      'Weather',
      sel('weather', [
        ['', 'Where you are'],
        ['clear', 'Clear'],
        ['cloudy', 'Cloudy'],
        ['fog', 'Fog'],
        ['drizzle', 'Drizzle'],
        ['rain', 'Rain'],
        ['storm', 'Storm'],
        ['snow', 'Snow']
      ])
    )}
    ${row('Wind', '<input type="range" data-k="windFrom" min="0" max="359" step="1"><input type="range" data-k="windSpeed" min="0" max="50" step="1">')}
    ${row(
      'Look',
      sel(
        'look',
        api.looks.map((l) => [l, l[0].toUpperCase() + l.slice(1)])
      )
    )}
    <div class="pv-acts"><button data-act="flies">Summer night, fireflies</button><button data-act="back">A returning visitor</button></div>
    <div class="pv-acts"><button data-act="album">Seal album</button><button data-act="stamp">Stamp all seals</button><button data-act="unstamp">Clear seals</button></div>
  </div>`;
  const body = el.querySelector('.pv-body'),
    tog = el.querySelector('.pv-tog');
  tog.addEventListener('click', () => {
    body.hidden = !body.hidden;
    tog.setAttribute('aria-expanded', String(!body.hidden));
  });
  el.querySelector('[data-k=moon]').value = api.moon();
  el.addEventListener('input', (e) => {
    const k = e.target.dataset.k,
      v = e.target.value;
    if (k === 'fest') api.festival(v || null);
    if (k === 'phase') api.phase(v);
    if (k === 'moon') api.moon(Number(v));
    if (k === 'weather') api.weather(v || null);
    if (k === 'windFrom' || k === 'windSpeed')
      api.wind(Number(el.querySelector('[data-k=windFrom]').value), Number(el.querySelector('[data-k=windSpeed]').value));
    if (k === 'look') api.look(v);
  });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'flies') api.fireflies();
    if (a === 'back') api.welcomeBack();
    if (a === 'album') api.album();
    if (a === 'stamp') api.stampAll();
    if (a === 'unstamp') api.clearSeals();
  });
  // a press inside never reaches the water
  for (const ev of ['pointerdown', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());
  return el;
}
