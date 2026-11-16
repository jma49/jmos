// The pond that ages: how many visitors have reached the pond's third
// ending (docs/decisions/0029-no-name-the-third-ending.md), which the
// database counts, a row to a visitor (public.pond_endings,
// supabase/migrations/20261116063425_pond_endings.sql). The Supabase side
// is supabase/pond.ts, the stand-in's local/pond.ts.
//
// The pond works without either answer, so neither call throws: a count
// that can't be read is 0, and an ending that couldn't be recorded says
// so, for the pond to try again another day.

export interface PondSocial {
  /** How many visitors have reached the pond's third ending; 0 when the database can't say. */
  pondEndings: () => Promise<number>;
  /**
   * Records that this visitor reached the end. The database counts a
   * visitor once, so asking again changes nothing and is no error. True
   * once the database has them, false when it couldn't take it now (too
   * many new visitors in the hour, or no database reached).
   */
  reachPondEnding: () => Promise<boolean>;
}
