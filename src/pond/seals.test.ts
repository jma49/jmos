import { describe, expect, it } from 'vitest';
import {
  NEXT,
  WAY,
  walked,
  clueFor,
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

// every look ships, so a release build's album is the whole of it; most cases here use a smaller one (the
// first two painted looks, the first three drawn ones), as a build that left looks out would have
// (the two volumes of looks; the third, of occasions, has its own cases)
const preview = volumes(false).slice(0, 2),
  live = preview.map((v) => ({ ...v, seals: v.seals.slice(0, v.id === 'painted' ? 2 : 3) }));

describe('the volumes', () => {
  it('hold every look in a release build, five to a volume', () => {
    expect(volumes(false)).toEqual(volumes(true));
    expect(volumes(false).map((v) => v.id)).toEqual(['painted', 'drawn', 'hours', 'end', 'idle']);
    expect(live.map((v) => v.seals.map((s) => s.id))).toEqual([
      ['ink', 'ukiyo'],
      ['glow', 'blueprint', 'ascii']
    ]);
    expect(preview.map((v) => v.seals.length)).toEqual([5, 5]);
    // no place is kept for a look still to come, so the album says nothing of one
    expect(preview.map((v) => v.soon)).toEqual([0, 0]);
    expect(stamp(emptyAlbum(), 'relief', '2026-11-12', preview).fresh).toBe(true);
    expect(albumHTML(emptyAlbum(), preview, 'en')).not.toContain(SEAL_WORDS.en.soon);
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

describe('the clues', () => {
  it('lead through each volume in order, and stop once the next seal is found', () => {
    for (const v of volumes(false).slice(0, 2)) {
      const ids = v.seals.map((x) => x.id);
      ids.slice(0, -1).forEach((id, i) => expect(NEXT[id]).toBe(ids[i + 1]));
      expect(NEXT[ids[ids.length - 1]]).toBeUndefined();
    }
    expect(clueFor('ink', emptyAlbum())).toBe('ukiyo');
    expect(clueFor('ink', stamp(emptyAlbum(), 'ukiyo', '2026-11-13', volumes(false)).album)).toBe('');
    expect(clueFor('water', emptyAlbum())).toBe('');
    expect(clueFor('relief', emptyAlbum())).toBe('');
  });
});

describe('the end', () => {
  it('is one seal in a volume of its own, and the album is not full without it', () => {
    const all = volumes(false);
    expect(all[3].seals.map((x) => x.id)).toEqual(['rubbing']);
    let a = emptyAlbum();
    for (const v of all.slice(0, 2)) for (const x of v.seals) a = stamp(a, x.id, '2026-11-13', all).album;
    expect(allFull(a, all)).toBe(false);
    expect(allFull(stamp(a, 'rubbing', '2026-11-14', all).album, all)).toBe(true);
  });
  it('is opened by pressing the looks\u2019 seals in the order the album keeps them', () => {
    expect(WAY).toEqual(['ink', 'ukiyo', 'monet', 'qinghua', 'dunhuang', 'glow', 'blueprint', 'ascii', 'stars', 'relief']);
    let steps: string[] = [];
    for (const id of WAY) steps = walked(steps, id);
    expect(steps).toEqual(WAY);
    // a wrong seal starts the way again; the first seal starts it from one
    expect(walked(['ink', 'ukiyo'], 'glow')).toEqual([]);
    expect(walked(['ink', 'ukiyo'], 'ink')).toEqual(['ink']);
    expect(walked([], 'ukiyo')).toEqual([]);
  });
});

describe('the idle seals', () => {
  it('are stamped like any other, and the album is full without them', () => {
    const all = volumes(false);
    let a = emptyAlbum();
    for (const v of all.filter((x) => !x.extra)) for (const x of v.seals) a = stamp(a, x.id, '2026-11-13', all).album;
    expect(allFull(a, all)).toBe(true);
    expect(stamp(a, 'skip', '2026-11-14', all).fresh).toBe(true);
    expect(all.at(-1)?.seals.map((x) => x.id)).toEqual(['skip', 'leap', 'catch', 'race']);
  });
});

describe('the occasions', () => {
  const all = volumes(false),
    hours = all[2];
  it('are five seals, each stamped once like any other, and the album is full without them', () => {
    expect(hours.seals.map((s) => s.id)).toEqual(['rain', 'snow', 'moon', 'fest', 'dawn']);
    expect(hours.extra).toBe(true);
    let a = emptyAlbum();
    for (const v of all.filter((x) => !x.extra)) for (const s of v.seals) a = stamp(a, s.id, '2026-11-13', all).album;
    expect(allFull(a, all)).toBe(true);
    const r = stamp(a, 'rain', '2026-11-14', all);
    expect(r.fresh).toBe(true);
    expect(stamp(r.album, 'rain', '2026-11-15', all).fresh).toBe(false);
  });
  it('leave the word for a full album under the last volume that counts', () => {
    let a = emptyAlbum();
    for (const v of all.filter((x) => !x.extra)) for (const s of v.seals) a = stamp(a, s.id, '2026-11-13', all).album;
    const leaves = albumHTML(a, all, 'en').split('<section class="vol"').slice(1),
      said = leaves.map((l) => l.includes(SEAL_WORDS.en.both));
    expect(said).toEqual([false, false, false, true, false]);
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
  it('shows a found seal with its day, and a hint and a faint print in place of one not yet found', () => {
    const a = stamp(emptyAlbum(), 'ink', '2026-11-12', live).album,
      html = albumHTML(a, live, 'en');
    expect(html).toContain('12 Nov 2026');
    expect(html).toContain('>墨<');
    expect(html).toContain(SEAL_WORDS.en.hints.ukiyo);
    expect(html).not.toContain(SEAL_WORDS.en.hints.ink);
    // one not found is printed faintly in its empty place, never as found
    expect(html).toContain('<li><b class="seal-m blank" data-shape="tall"');
    expect(html).not.toContain('data-id="ukiyo"');
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
