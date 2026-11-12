// Where ink's seasonal painting hangs (painting.js draws it there; engine.js keeps the lily pads out from
// under it). Each painting enters at its right edge and reaches left.

/**
 * [x, y, size] on a pond of W by H for a season (0 spring … 3 winter). The willow hangs from the top, a little
 * in from the edge so the solar term's column stands clear of it; the lotus, the reeds and the plum rise
 * from the foot. On a phone every one keeps to the lower right, clear of the type and above the controls.
 */
export function hang(W, H, season) {
  if (W < 600) {
    const size = Math.min(W * 0.86, H * 0.46);
    return [W - size, H - size - 76, size];
  }
  const size = Math.min(H * 0.9, W * 0.5);
  return season === 0 ? [W - size - 96, 0, size] : [W - size, H - size - 24, size];
}
/** Whether a place lies under the painting's own ink (its right two thirds, between its upper and lower margins). */
export function underPainting(x, y, W, H, season) {
  const [hx, hy, size] = hang(W, H, season);
  return x > hx + size * 0.34 && x < hx + size && y > hy + size * 0.08 && y < hy + size * 0.92;
}
