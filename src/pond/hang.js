// Where ink's seasonal painting hangs (painting.js draws it there; engine.js keeps the lily pads out from
// under it). Each painting enters at its right edge and reaches left.

/**
 * [x, y, size] on a pond of W by H for a season (0 spring … 3 winter). The willow hangs from the top; the lotus,
 * the reeds and the plum rise from the foot. Each has the region to itself: no pad lies in it, and the solar
 * term's column and the focus gauge stand outside it. On a phone every one keeps to the lower right, clear of the type and above the controls.
 */
export function hang(W, H, season) {
  if (W < 600) {
    const size = Math.min(W * 0.86, H * 0.46);
    return [W - size, H - size - 76, size];
  }
  // on a wide pond the right edge has the solar term's column above and the focus gauge in the middle:
  // the painting hangs clear of both, a column's width in from the edge
  const size = Math.min(H * 0.86, W * 0.48),
    x = W - size - (W >= 860 ? 104 : 0);
  return season === 0 ? [x, 0, size] : [x, H - size - 24, size];
}
/** Whether a place lies under the painting's own ink (its right two thirds, between its upper and lower margins). */
export function underPainting(x, y, W, H, season) {
  const [hx, hy, size] = hang(W, H, season);
  return x > hx + size * 0.34 && x < hx + size && y > hy + size * 0.08 && y < hy + size * 0.92;
}
/**
 * Whether a lily pad at a place would crowd the painting: anywhere from a little left of its ink to the
 * pond's right edge, over the painting's whole height and a little more. Pads keep out of all of it.
 */
export function crowdsPainting(x, y, W, H, season) {
  const [hx, hy, size] = hang(W, H, season);
  return x > hx + size * 0.2 && y > hy - size * 0.06 && y < hy + size * 1.06;
}
