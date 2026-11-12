// The pond's clock: how often it draws, and how far the ripples step, by time rather than by frames.
// A display at 60 Hz and one at 120 Hz see the same water; a slow frame catches up only so far.

/** Ripple steps a second: the water was tuned at two steps a frame at 60 Hz. */
export const SIM_RATE = 120;
/** At most this many steps in one frame; time beyond it is dropped rather than run all at once. */
export const MAX_STEPS = 8;
/** Frames a second while something is happening, and once the pond has gone quiet. */
export const FPS = 30;
export const IDLE_FPS = 10;
/** Seconds without input before the pond counts as quiet. */
export const IDLE_AFTER = 6;

/**
 * Steps owed for `seconds` of time at `timeScale` (ink slows time), given what was left over:
 * returns [steps to run now, what is left for the next frame].
 */
export function simSteps(left, seconds, timeScale = 1) {
  const owed = left + Math.max(0, seconds) * SIM_RATE * timeScale,
    n = Math.min(MAX_STEPS, Math.floor(owed));
  return [n, n === MAX_STEPS ? Math.min(owed - n, 1) : owed - n];
}

/** How long until the next frame is due, in ms, given when this one started and whether the pond is busy. */
export function frameGap(started, now, busy) {
  return Math.max(0, started + 1000 / (busy ? FPS : IDLE_FPS) - now);
}
