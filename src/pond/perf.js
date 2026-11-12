// With ?perf (or a build with PUBLIC_POND_PERF=1): a small overlay with the pond's real numbers (fps,
// each part of a frame's CPU time, the GPU's time for the water and glass passes where the browser can
// measure it, the render scale) so they can be read on a real machine. Not shown otherwise, and it costs
// nothing then: every timing call is skipped.

export const PERF = (typeof location !== 'undefined' && /[?&]perf\b/.test(location.search)) || !!import.meta.env.PUBLIC_POND_PERF;

const sums = {},
  counts = {},
  frames = [];
let at = 0,
  el = null;
/** Times a part of the frame (only with ?perf). */
export function span(name, f) {
  if (!PERF) return f();
  const a = performance.now();
  try {
    return f();
  } finally {
    sums[name] = (sums[name] || 0) + performance.now() - a;
  }
}
/** Counts something that happens (only with ?perf); shown as a number a second. */
export function count(name) {
  if (PERF) counts[name] = (counts[name] || 0) + 1;
}
/** Adds a measured time to a part of the frame (only with ?perf). */
export function add(name, ms) {
  if (PERF) sums[name] = (sums[name] || 0) + ms;
}
/** Called once a frame drawn; shows the averages twice a second. */
export function frameDone(now, info) {
  if (!PERF) return;
  frames.push(now);
  if (now - at < 500) return;
  // frames drawn since the last report, over the time since it (a slow renderer may draw only one or two)
  const n = frames.length,
    secs = at ? (now - at) / 1000 : 0;
  if (!el) {
    el = document.createElement('pre');
    el.className = 'perf';
    document.body.append(el);
  }
  const ms = Object.entries(sums)
    .map(([k, v]) => `${k.padEnd(6)} ${(v / Math.max(1, n)).toFixed(2)} ms`)
    .join('\n');
  const per = Object.entries(counts)
    .map(([k, v]) => `${k.padEnd(6)} ${secs > 0 ? (v / secs).toFixed(1) : '–'}/s`)
    .join('\n');
  el.textContent = `${secs > 0 ? (n / secs).toFixed(0) : '–'} fps\n${ms}${per ? '\n' + per : ''}\ngpu    ${info.gpu == null ? 'n/a' : info.gpu.toFixed(2) + ' ms'}\npass   ${info.pass}\nscale  ${info.scale}\nquality ${info.quality.toFixed(2)}`;
  window.__pondPerf = {
    fps: secs > 0 ? n / secs : 0,
    ...Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / Math.max(1, n)])),
    ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k + '/s', secs > 0 ? v / secs : 0])),
    gpu: info.gpu,
    pass: info.pass,
    scale: info.scale,
    quality: info.quality
  };
  for (const k in sums) delete sums[k];
  for (const k in counts) delete counts[k];
  frames.length = 0;
  at = now;
}
