// Makes us-map.json, the state outlines the left screen draws: node build-map.mjs
//
// The shapes come from us-atlas's states-albers-10m.json, which is already projected (Albers USA
// on a 975 x 610 sheet). They are simplified as a topology, so neighbours keep sharing one border,
// and written as one SVG path per state (relative moves, tenths of a unit). The city dots of
// places.json go through the same projection us-atlas used, so they land where the shapes say.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { geoAlbersUsa } from 'd3-geo';

const AREA = 0.7; // the smallest triangle kept, in square units of the sheet
const POSTAL = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  10: 'DE',
  11: 'DC',
  12: 'FL',
  13: 'GA',
  15: 'HI',
  16: 'ID',
  17: 'IL',
  18: 'IN',
  19: 'IA',
  20: 'KS',
  21: 'KY',
  22: 'LA',
  23: 'ME',
  24: 'MD',
  25: 'MA',
  26: 'MI',
  27: 'MN',
  28: 'MS',
  29: 'MO',
  30: 'MT',
  31: 'NE',
  32: 'NV',
  33: 'NH',
  34: 'NJ',
  35: 'NM',
  36: 'NY',
  37: 'NC',
  38: 'ND',
  39: 'OH',
  40: 'OK',
  41: 'OR',
  42: 'PA',
  44: 'RI',
  45: 'SC',
  46: 'SD',
  47: 'TN',
  48: 'TX',
  49: 'UT',
  50: 'VT',
  51: 'VA',
  53: 'WA',
  54: 'WV',
  55: 'WI',
  56: 'WY'
};

const here = (name) => new URL(name, import.meta.url);
const atlas = JSON.parse(readFileSync(here('./node_modules/us-atlas/states-albers-10m.json')));
const topology = simplify(presimplify(atlas), AREA);
const r = (v) => Math.round(v * 10) / 10;
const num = (v) => String(r(v)).replace(/^(-?)0\./, '$1.');

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

/** The centroid of a ring's area: where the state's name goes. */
function ringCentre(ring) {
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const w = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a += w;
    cx += (ring[i][0] + ring[i + 1][0]) * w;
    cy += (ring[i][1] + ring[i + 1][1]) * w;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

const states = {};
for (const f of feature(topology, topology.objects.states).features) {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = '',
    box = [Infinity, Infinity, -Infinity, -Infinity],
    best = 0,
    centre = [0, 0];
  for (const polygon of polygons) {
    // islets too small to see or to press are left out
    if (ringArea(polygon[0]) < 1.5 && polygons.length > 1) continue;
    for (const ring of polygon) {
      let px = 0,
        py = 0;
      ring.slice(0, -1).forEach(([x, y], i) => {
        const X = r(x),
          Y = r(y);
        if (i && X === px && Y === py) return;
        d += i ? `${i === 1 ? 'l' : ' '}${num(X - px)},${num(Y - py)}` : `M${num(X)},${num(Y)}`;
        px = X;
        py = Y;
        box = [Math.min(box[0], X), Math.min(box[1], Y), Math.max(box[2], X), Math.max(box[3], Y)];
      });
      d += 'z';
    }
    const a = ringArea(polygon[0]);
    if (a > best) {
      best = a;
      centre = ringCentre(polygon[0]).map(r);
    }
  }
  states[POSTAL[f.id]] = { name: f.properties.name, d, box, centre };
}

// what us-atlas projected with
const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const cities = {};
for (const place of JSON.parse(readFileSync(here('./places.json'))).places) {
  if (!states[place.state]) throw new Error(`places.json: no state ${place.state}`);
  if (place.city && place.lonLat) cities[place.state] = projection(place.lonLat).map(r);
}

const out = JSON.stringify({ width: 975, height: 610, states, cities });
writeFileSync(here('./us-map.json'), out + '\n');
console.log('us-map.json', out.length, 'bytes,', Object.keys(states).length, 'states, cities', JSON.stringify(cities));
