import { describe, expect, it } from 'vitest';
import {
  SEAL_WORDS,
  VOLUMES,
  albumHTML,
  allFull,
  clearSeals,
  count,
  dayOf,
  dayText,
  emptyAlbum,
  entryShows,
  full,
  markSealed,
  mayHint,
  readAlbum,
  stamp,
  volumes,
  writeAlbum
} from './seals';

const live = volumes(false),
  preview = volumes(true);

describe('the volumes', () => {
  it('leave the preview looks out of a build that is not one', () => {
    expect(live.map((v) => v.seals.map((s) => s.id))).toEqual([
      ['ink', 'ukiyo'],
      ['glow', 'blueprint', 'ascii']
    ]);
    expect(preview.map((v) => v.seals.length)).toEqual([5, 4]);
    // the place kept for the look that replaces the blackboard: shown, never stamped
    expect(preview[1].soon).toBe(1);
    expect(stamp(emptyAlbum(), 'chalk', '2026-11-12', preview).fresh).toBe(false);
    expect(albumHTML(emptyAlbum(), preview, 'en')).toContain(SEAL_WORDS.en.soon);
    expect(albumHTML(emptyAlbum(), live, 'en')).not.toContain(SEAL_WORDS.en.soon);
  });
  it('give every seal its own id, one or two characters, and words in each language', () => {
    const all = VOLUMES.flatMap((v) => v.seals);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) {
      expect([...s.chars].length).toBeGreaterThan(0);
      expect([...s.chars].length).toBeLessThan(3);
      for (const w of Object.values(SEAL_WORDS)) {
        expect(w.names[s.id]).toBeTruthy();
        expect(w.hints[s.id]).toBeTruthy();
      }
    }
    for (const v of VOLUMES) for (const w of Object.values(SEAL_WORDS)) expect(w.volumes[v.id] && w.thanks[v.id]).toBeTruthy();
  });
});

describe('stamping', () => {
  it('stamps a seal once and keeps the day it was first found', () => {
    const one = stamp(emptyAlbum(), 'ink', '2026-11-12', live);
    expect(one.fresh).toBe(true);
    expect(one.album.found).toEqual({ ink: '2026-11-12' });
    const again = stamp(one.album, 'ink', '2026-12-01', live);
    expect(again.fresh).toBe(false);
    expect(again.album).toBe(one.album);
  });
  it('does not change the album it was given', () => {
    const a = emptyAlbum();
    stamp(a, 'ink', '2026-11-12', live);
    expect(a.found).toEqual({});
  });
  it('knows no seal for the water, or for a look this build does not have', () => {
    expect(stamp(emptyAlbum(), 'water', '2026-11-12', live).fresh).toBe(false);
    expect(stamp(emptyAlbum(), 'monet', '2026-11-12', live).fresh).toBe(false);
    expect(stamp(emptyAlbum(), 'monet', '2026-11-12', preview).fresh).toBe(true);
  });
  it('says which volume the last of its seals fills, and when both are full', () => {
    let a = emptyAlbum();
    a = stamp(a, 'ink', '2026-11-12', live).album;
    expect(full(a, live[0])).toBe(false);
    const r = stamp(a, 'ukiyo', '2026-11-13', live);
    expect(r.filled?.id).toBe('painted');
    a = r.album;
    expect(allFull(a, live)).toBe(false);
    a = stamp(a, 'glow', '2026-11-13', live).album;
    a = stamp(a, 'blueprint', '2026-11-13', live).album;
    const last = stamp(a, 'ascii', '2026-11-14', live);
    expect(last.filled?.id).toBe('drawn');
    expect(allFull(last.album, live)).toBe(true);
    // with the preview looks, the same two are not yet a full volume
    expect(full(last.album, preview[0])).toBe(false);
  });
});

describe('clearing', () => {
  it('empties the seals and the large seals, and keeps what the visitor has already been shown', () => {
    let a = { ...emptyAlbum(), hinted: '2026-11-01', visits: 4 };
    a = stamp(a, 'ink', '2026-11-12', live).album;
    a = markSealed(a, 'painted');
    const c = clearSeals(a);
    expect(count(c)).toBe(0);
    expect(c.sealed).toEqual([]);
    expect(c.hinted).toBe('2026-11-01');
    expect(c.visits).toBe(4);
    expect(mayHint(c)).toBe(false);
  });
});

describe('what shows when', () => {
  it('offers the line once, and never after a seal', () => {
    expect(mayHint(emptyAlbum())).toBe(true);
    expect(mayHint({ ...emptyAlbum(), hinted: '2026-11-01' })).toBe(false);
    expect(mayHint(stamp(emptyAlbum(), 'ink', '2026-11-12', live).album)).toBe(false);
  });
  it('shows the album’s mark after a first seal, or on a later visit once the line has been shown', () => {
    expect(entryShows(emptyAlbum())).toBe(false);
    expect(entryShows({ ...emptyAlbum(), hinted: '2026-11-01', visits: 1 })).toBe(false);
    expect(entryShows({ ...emptyAlbum(), hinted: '2026-11-01', visits: 2 })).toBe(true);
    expect(entryShows({ ...emptyAlbum(), visits: 5 })).toBe(false);
    expect(entryShows(stamp(emptyAlbum(), 'glow', '2026-11-12', live).album)).toBe(true);
  });
});

describe('storing', () => {
  it('reads back what it wrote', () => {
    const a = markSealed(stamp({ ...emptyAlbum(), hinted: '2026-11-01', visits: 3 }, 'ink', '2026-11-12', live).album, 'painted');
    expect(readAlbum(writeAlbum(a))).toEqual(a);
  });
  it('makes an empty album of nothing, of what is not JSON, and of the wrong shape', () => {
    for (const raw of [null, '', 'nope', '[]', '42', '{"found":3,"sealed":"x","hinted":7,"visits":"many"}']) expect(readAlbum(raw)).toEqual(emptyAlbum());
    expect(readAlbum('{"found":{"ink":"yesterday","glow":"2026-11-12"}}').found).toEqual({ glow: '2026-11-12' });
  });
});

describe('days', () => {
  it('are the visitor’s own date, written as each language does', () => {
    expect(dayOf(new Date(2026, 10, 2))).toBe('2026-11-02');
    expect(dayText('2026-11-02', 'en')).toBe('2 Nov 2026');
    expect(dayText('2026-11-02', 'zh')).toBe('2026.11.2');
    expect(dayText('2026-11-02', 'ja')).toBe('2026年11月2日');
  });
});

describe('the album as a sheet', () => {
  it('shows a found seal with its day, and a hint in place of one not yet found', () => {
    const a = stamp(emptyAlbum(), 'ink', '2026-11-12', live).album,
      html = albumHTML(a, live, 'en');
    expect(html).toContain('12 Nov 2026');
    expect(html).toContain('>墨<');
    expect(html).toContain(SEAL_WORDS.en.hints.ukiyo);
    expect(html).not.toContain(SEAL_WORDS.en.hints.ink);
    expect(html).not.toContain('>浮<');
    expect(html).toContain('1 / 2');
  });
  it('puts the large seal and its thanks on a full volume only', () => {
    let a = stamp(emptyAlbum(), 'ink', '2026-11-12', live).album;
    expect(albumHTML(a, live, 'zh')).not.toContain('class="grand"');
    a = stamp(a, 'ukiyo', '2026-11-12', live).album;
    const html = albumHTML(a, live, 'zh', ['painted']);
    expect(html.match(/class="grand"/g)).toHaveLength(1);
    expect(html).toContain('data-fresh');
    expect(html).toContain(SEAL_WORDS.zh.koi);
    expect(html).not.toContain(SEAL_WORDS.zh.both);
  });
});
