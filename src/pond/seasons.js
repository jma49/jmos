// What the pond holds at each point of the year, by plain sense of the seasons (docs/agents/pond.md has the
// table). The year is counted in solar terms from 立春: 0 to 6 is spring, 6 to 12 summer, 12 to 18 autumn,
// 18 to 24 winter. Nothing here may put plum blossom's season and green lily pads together.

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** 1 at c, falling to nothing w terms either side (round the year's end). */
const hump = (x, c, w) => {
  let d = Math.abs(x - c);
  d = Math.min(d, 24 - d);
  return 1 - sstep(w * 0.45, w, d);
};

/**
 * How much of each thing there is, 0 to 1, at y terms after 立春:
 * - petals: peach and cherry, spring only;
 * - lush: the lily pads, coming up small in spring, full in summer, withering through autumn, gone by winter;
 * - bloom: the lotus in flower, summer only; flies: dragonflies, summer only;
 * - leaves: falling leaves, autumn only; brown: how withered the pads are;
 * - ice and snow: winter (the ice is slow to go, and lingers into the first days of spring).
 */
export function seasonAmounts(y) {
  const w = y < 3 ? y + 24 : y,
    su = hump(y, 10, 5),
    au = hump(y, 16.5, 4),
    wi = hump(y, 22, 4.5);
  return {
    petals: hump(y, 3, 3),
    bloom: hump(y, 9.6, 2.4),
    flies: hump(y, 9.2, 2.8),
    leaves: hump(y, 15, 3),
    lush: y < 18 ? sstep(1.5, 8.5, y) * (1 - 0.55 * sstep(12, 16, y)) * (1 - sstep(15.5, 18, y)) : 0,
    brown: y < 18 ? sstep(12, 16.5, y) : 0,
    ice: sstep(18.7, 21.6, w) * (1 - sstep(24.2, 25.8, w)),
    snow: hump(y, 21.6, 2.4),
    tint: [1 + 0.02 * su + 0.1 * au - 0.1 * wi, 1 + 0.02 * su - 0.03 * au - 0.02 * wi, 1 - 0.03 * su - 0.17 * au + 0.07 * wi],
    light: 1 + 0.25 * su - 0.4 * wi
  };
}
/** Which of ink's four paintings a point of the year shows: 0 willow, 1 lotus, 2 reeds and geese, 3 plum. */
export const paintingOf = (y) => Math.floor((Math.floor(y) % 24) / 6);
