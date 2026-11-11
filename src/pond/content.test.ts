import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATH, PROJECT_EXTRAS, THIS_POND } from './content';

const ids = new Set([...PATH.map((e) => e.id), ...Object.keys(PROJECT_EXTRAS), THIS_POND.id]);

describe('the pond’s timeline', () => {
  it('has a mark in public/pond/marks for every job, school and project', () => {
    for (const mark of [...PATH.map((e) => e.mark), ...Object.keys(PROJECT_EXTRAS), THIS_POND.id]) {
      expect(existsSync(`public/pond/marks/${mark}.png`), mark).toBe(true);
    }
  });

  it('lists the jobs and schools newest first', () => {
    const starts = PATH.map((e) => e.s);
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
  });

  it('points only at entries that exist', () => {
    for (const e of PATH) if (e.ref) expect(ids.has(e.ref[0]), e.ref[0]).toBe(true);
  });

  it('keeps unique ids, since they are the chapters’ addresses (#career/tiktok)', () => {
    const all = [...PATH.map((e) => e.id), ...Object.keys(PROJECT_EXTRAS), THIS_POND.id];
    expect(new Set(all).size).toBe(all.length);
  });
});
