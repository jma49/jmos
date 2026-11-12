// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the virtual clock the frame-sequence tools run the pond on: seeded random, time, timers and frames
// stepped by hand (window.__step(n), 50 ms a step), no audio. For page.addInitScript(INIT, hour).
const INIT = (hour = 2) => {
  let s = 12345;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let vt = 1000;
  const epoch = Date.UTC(2026, 5, 20, hour, 0, 0); // a June day, at that hour (the tools set the time zone to UTC)
  performance.now = () => vt;
  const RD = Date;
  window.Date = class extends RD {
    constructor(...a) {
      super(...(a.length ? a : [epoch + vt]));
    }
    static now() {
      return epoch + vt;
    }
  };
  let q = [];
  window.requestAnimationFrame = (f) => (q.push(f), q.length);
  window.cancelAnimationFrame = () => {};
  let tid = 1,
    timers = new Map();
  const later =
    (rep) =>
    (f, ms = 0, ...a) => {
      const id = tid++;
      timers.set(id, { at: vt + Math.max(0, +ms || 0), f, a, rep: rep ? Math.max(1, +ms || 0) : 0, id });
      return id;
    };
  window.setTimeout = later(false);
  window.setInterval = later(true);
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const fire = () => {
    for (let k = 0; k < 1000; k++) {
      let t = null;
      for (const x of timers.values()) if (x.at <= vt && (!t || x.at < t.at || (x.at === t.at && x.id < t.id))) t = x;
      if (!t) return;
      if (t.rep) t.at += t.rep;
      else timers.delete(t.id);
      try {
        typeof t.f === 'function' ? t.f(...t.a) : 0;
      } catch (e) {
        console.error(e);
      }
    }
  };
  window.__step = (n) => {
    for (let i = 0; i < n; i++) {
      vt += 50;
      fire();
      const c = q;
      q = [];
      for (const f of c) f(vt);
    }
  };
  window.requestIdleCallback = undefined;
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, 'getBattery', { value: undefined });
};
module.exports = { INIT };
