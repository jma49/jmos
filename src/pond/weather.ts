// The weather where the visitor is, for the pond: their place from their IP address (api/geo.ts, as the
// desktop does), then the current weather, wind and daylight from Open-Meteo (the only service the
// place is sent to; CSP already allows it). Kept in this browser for half an hour, so a reload doesn't
// fetch again; nothing is stored anywhere else. Any failure means no weather, quietly.

export type Condition = 'clear' | 'cloudy' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface PondWeather {
  condition: Condition;
  temp: number;
  unit: 'C' | 'F';
  city: string;
  latitude: number;
  timeZone: string;
  /** Minutes after local midnight at the place. */
  sunrise: number;
  sunset: number;
  /** km/h, and the direction it blows from, in degrees. */
  windSpeed: number;
  windFrom: number;
}

/** Where Jincheng is: the place when the visitor can't be found (as HOME in src/os/ambient/place.ts). */
const HOME = { city: 'San Jose', country: 'US', latitude: 37.3382, longitude: -121.8863, timeZone: 'America/Los_Angeles' };
const FAHRENHEIT = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'LR', 'MM', 'BS', 'KY', 'PW', 'FM', 'MH']);

/** WMO weather codes, grouped as the desktop groups them (src/os/ambient/weather.ts). */
export function conditionOf(code: number): Condition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'clear';
}

/** What a condition does to the pond: how hard it rains, whether it snows, haze, how much light. */
export interface Effects {
  /** 0 none; 0.5 drizzle; 1 rain; 1.6 a storm. */
  rain: number;
  snow: number;
  fog: number;
  /** The light and the sun's or moon's glint, as a share of a clear sky's. */
  light: number;
  glint: number;
  thunder: boolean;
}
export function effectsOf(c: Condition): Effects {
  const e: Effects = { rain: 0, snow: 0, fog: 0, light: 1, glint: 1, thunder: false };
  if (c === 'cloudy') Object.assign(e, { light: 0.9, glint: 0.6 });
  if (c === 'overcast') Object.assign(e, { light: 0.8, glint: 0.25 });
  if (c === 'fog') Object.assign(e, { fog: 1, light: 0.85, glint: 0.2 });
  if (c === 'drizzle') Object.assign(e, { rain: 0.5, light: 0.85, glint: 0.3 });
  if (c === 'rain') Object.assign(e, { rain: 1, light: 0.8, glint: 0.2 });
  if (c === 'storm') Object.assign(e, { rain: 1.6, light: 0.7, glint: 0.1, thunder: true });
  if (c === 'snow') Object.assign(e, { snow: 0.7, light: 0.9, glint: 0.4 });
  return e;
}

/** The season the pond shows, in solar terms (0 is 立春): half a year on, south of the equator. */
export const seasonOf = (term: number, latitude: number) => (latitude < 0 ? (term + 12) % 24 : term);

/** The time of day at the place, from its own sunrise and sunset (minutes after midnight). */
export function phaseAt(minutes: number, sunrise: number, sunset: number): 'dawn' | 'day' | 'dusk' | 'night' {
  if (minutes >= sunrise - 40 && minutes < sunrise + 50) return 'dawn';
  if (minutes >= sunrise + 50 && minutes < sunset - 50) return 'day';
  if (minutes >= sunset - 50 && minutes < sunset + 40) return 'dusk';
  return 'night';
}

/** Minutes after midnight now at a time zone. */
export function minutesAt(timeZone: string, d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
    const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    return get('hour') * 60 + get('minute');
  } catch {
    return d.getHours() * 60 + d.getMinutes();
  }
}

const KEY = 'pond-weather',
  TTL = 30 * 60_000;
const minutesOf = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
};

/** The weather where the visitor is: from this browser's half-hour cache, else fetched. Null on any failure. */
export async function loadWeather(): Promise<PondWeather | null> {
  try {
    const hit = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (hit && Date.now() - hit.at < TTL) return hit.w;
  } catch {
    /* no storage here: fetch */
  }
  try {
    let place: { city?: string; country?: string; latitude: number; longitude: number; timeZone?: string } = HOME;
    try {
      const r = await fetch('/api/geo');
      if (r.status === 200) place = await r.json();
    } catch {
      /* not located: Jincheng's weather, then */
    }
    const tz = place.timeZone || HOME.timeZone,
      unit = FAHRENHEIT.has(place.country ?? '') ? 'F' : 'C';
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${place.latitude}&longitude=${place.longitude}` +
        '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset' +
        `&temperature_unit=${unit === 'F' ? 'fahrenheit' : 'celsius'}&timezone=${encodeURIComponent(tz)}&forecast_days=1`
    );
    if (!r.ok) return null;
    const j = await r.json();
    const w: PondWeather = {
      condition: conditionOf(j.current.weather_code),
      temp: Math.round(j.current.temperature_2m),
      unit,
      city: place.city || HOME.city,
      latitude: place.latitude,
      timeZone: tz,
      sunrise: minutesOf(j.daily.sunrise[0]),
      sunset: minutesOf(j.daily.sunset[0]),
      windSpeed: j.current.wind_speed_10m ?? 0,
      windFrom: j.current.wind_direction_10m ?? 0
    };
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), w }));
    } catch {
      /* not kept: fetched again next time */
    }
    return w;
  } catch {
    return null;
  }
}
