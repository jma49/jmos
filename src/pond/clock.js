// The pond's clock: how often it draws, and how far the ripples step, by time rather than by frames.
// A display at 60 Hz and one at 120 Hz see the same water; a slow frame catches up only so far.

/** Ripple steps a second: the water was tuned at two steps a frame at 60 Hz. */
export const SIM_RATE = 120;
/** At most this many steps in one frame; time beyond it is dropped rather than run all at once. */
export const MAX_STEPS = 8;
/**
 * Frames a second while something is happening, and once the pond has gone quiet. The koi are always
 * swimming, so quiet is not still: at ten frames they stepped visibly, and thirty is the least that reads
 * as swimming. Both are well under a 120 Hz display's own rate.
 */
export const FPS = 60;
export const IDLE_FPS = 30;
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

/**
 * Frames are drawn on the display's own beats, every nth one, so they come evenly: a timer that waits
 * a thirtieth of a second and then for the next beat lands 33 or 42 ms apart, and the koi judder.
 * Given the time of this beat, when a frame was last drawn and the beat's length (ms), says whether
 * to draw on this one.
 */
export function due(now, drawnAt, vsync, busy) {
  if (!drawnAt) return true;
  const every = Math.max(1, Math.round(1000 / (busy ? FPS : IDLE_FPS) / vsync));
  return now - drawnAt >= every * vsync - vsync * 0.5;
}

/** The display's beat, learnt from the gaps between beats (a gap much longer than a beat is a skipped one). */
export function learnBeat(vsync, gap) {
  if (!(gap > 3 && gap < vsync * 1.6)) return vsync;
  return vsync + (gap - vsync) * 0.1;
}
