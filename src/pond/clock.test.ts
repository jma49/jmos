import { describe, expect, it } from 'vitest';
import { FPS, IDLE_FPS, MAX_STEPS, SIM_RATE, frameGap, simSteps } from './clock.js';

// Run `seconds` of frames at `hz`, as the loop does, and count the ripple steps taken.
function stepsOver(hz: number, seconds: number, timeScale = 1) {
  let left = 0,
    total = 0;
  for (let f = 0; f < Math.round(hz * seconds); f++) {
    const [n, rest] = simSteps(left, 1 / hz, timeScale);
    total += n;
    left = rest;
  }
  return total;
}

describe('the ripple clock', () => {
  it('steps the water at the same speed at 30, 60 and 120 Hz', () => {
    for (const hz of [30, 60, 120]) expect(Math.abs(stepsOver(hz, 10) - SIM_RATE * 10)).toBeLessThanOrEqual(1);
  });
  it('slows with time in ink', () => {
    expect(Math.abs(stepsOver(60, 10, 0.32) - SIM_RATE * 10 * 0.32)).toBeLessThanOrEqual(1);
  });
  it('catches up only so far after a long frame', () => {
    const [n, left] = simSteps(0, 2);
    expect(n).toBe(MAX_STEPS);
    expect(left).toBeLessThanOrEqual(1);
  });
  it('never steps backwards', () => {
    expect(simSteps(0.5, -1)).toEqual([0, 0.5]);
  });
});

describe('the frame clock', () => {
  it('waits a thirtieth of a second when busy, a tenth when quiet', () => {
    expect(frameGap(0, 0, true)).toBeCloseTo(1000 / FPS);
    expect(frameGap(0, 0, false)).toBeCloseTo(1000 / IDLE_FPS);
    expect(frameGap(0, 50, true)).toBe(0);
  });
});
