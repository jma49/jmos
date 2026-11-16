// Which season the room's window shows (main.js), apart from three.js so it can be tested
// (season.test.ts). The seasons are the northern meteorological ones, by the visitor's own
// calendar: the room is in the northern hemisphere wherever the visitor is.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** The season a date falls in: March to May spring, June to August summer, September to November autumn, December to February winter. */
export function seasonOf(date: Date): Season {
  const month = date.getMonth(); // 0 is January
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/** A season's name as the address gives it (?season=), or null when it names none. */
export function parseSeason(value: string | null | undefined): Season | null {
  const name = value?.trim().toLowerCase();
  return SEASONS.find((season) => season === name) ?? null;
}

/** The season after this one, round the year. */
export function nextSeason(season: Season): Season {
  return SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
}
