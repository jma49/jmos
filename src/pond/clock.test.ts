import { describe, expect, it } from 'vitest';
import { FPS, IDLE_FPS, MAX_STEPS, SIM_RATE, due, learnBeat, simSteps } from './clock.js';

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

// Run `seconds` of a display's beats at `hz`, drawing when due, and return the gaps between frames drawn.
function drawn(hz: number, busy: boolean, seconds = 2) {
  const beat = 1000 / hz,
    gaps: number[] = [];
  let at = 0;
  for (let b = 1; b <= hz * seconds; b++) {
    const now = b * beat;
    if (due(now, at, beat, busy)) {
      if (at) gaps.push(now - at);
      at = now;
    }
  }
  return gaps;
}

describe('the frame clock', () => {
  it('draws on evenly spaced beats, at the busy and the quiet pace, on 60 and 120 Hz displays', () => {
    for (const hz of [60, 120])
      for (const busy of [true, false]) {
        const gaps = drawn(hz, busy);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.01);
        expect(1000 / gaps[0]).toBeCloseTo(Math.min(hz, busy ? FPS : IDLE_FPS), 0);
      }
  });
  it('learns the beat and ignores a skipped one', () => {
    let v = 1000 / 60;
    for (let i = 0; i < 80; i++) v = learnBeat(v, 1000 / 120);
    expect(v).toBeCloseTo(1000 / 120, 1);
    expect(learnBeat(v, 40)).toBe(v);
  });
});
