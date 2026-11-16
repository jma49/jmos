import { afterEach, describe, expect, test, vi } from 'vitest';
import { backends, type Backend } from './backends';

// The pond's endings, the same on both backends: everyone reads the
// count, a visitor who reaches the end is counted once, and neither call
// throws, whatever the database answers.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(backends)('pond: $name', ({ make }) => {
  let b: Backend;

  test('a visitor who reaches the end is counted once', async () => {
    b = make();
    expect(await b.social.pondEndings()).toBe(0);
    expect(await b.social.reachPondEnding()).toBe(true);
    // The database's trigger adds no row for a visitor it has, and answers as for a new one.
    expect(await b.social.reachPondEnding()).toBe(true);
    await b.given({ supabase: (db) => db.answer('pond_endings.select', { count: 1 }) });
    expect(await b.social.pondEndings()).toBe(1);
    // The site sends nothing of its own: the database writes who and when.
    if (b.db) expect(b.db.last('pond_endings')).toMatchObject({ op: 'select' });
    if (b.db)
      expect(b.db.calls.filter((c) => c.target === 'pond_endings' && c.op === 'insert').map((c) => c.payload)).toEqual([{ visitor: '' }, { visitor: '' }]);
  });

  test('signed in or not, it is the same visitor', async () => {
    b = make();
    expect(await b.social.reachPondEnding()).toBe(true);
    await b.signUp('alice');
    expect(await b.social.reachPondEnding()).toBe(true);
    await b.given({ supabase: (db) => db.answer('pond_endings.select', { count: 1 }) });
    expect(await b.social.pondEndings()).toBe(1);
  });

  test('a database that refuses or can’t be read is no error', async () => {
    b = make();
    if (!b.db) return;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The hourly limit on new visitors, then a database without the table.
    b.db.refuse('pond_endings.insert', 'P0429', 'The pond is very busy right now. Try again in an hour.');
    expect(await b.social.reachPondEnding()).toBe(false);
    b.db.refuse('pond_endings.insert', '42P01', 'relation "public.pond_endings" does not exist');
    expect(await b.social.reachPondEnding()).toBe(false);
    b.db.refuse('pond_endings.select', '42P01', 'relation "public.pond_endings" does not exist');
    expect(await b.social.pondEndings()).toBe(0);
    vi.restoreAllMocks();
  });
});
