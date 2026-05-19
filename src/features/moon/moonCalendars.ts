import * as Astronomy from 'astronomy-engine';
import { geocentricMoonEclipticLongitudeDeg, geocentricPlanetEclipticLongitudeDeg, type MoonDashboard } from './astro';

/** Точка наблюдения для горизонта и планетарных часов — Москва (фиксированно в приложении). */
export const MOSCOW_OBSERVER_LAT = 55.7558;
export const MOSCOW_OBSERVER_LON = 37.6173;
export const MOSCOW_OBSERVER_HEIGHT_M = 120;
export const DEFAULT_MOON_OBSERVER = new Astronomy.Observer(
  MOSCOW_OBSERVER_LAT,
  MOSCOW_OBSERVER_LON,
  MOSCOW_OBSERVER_HEIGHT_M,
);

const PLANETS: Astronomy.Body[] = [
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
  Astronomy.Body.Uranus,
  Astronomy.Body.Neptune,
  Astronomy.Body.Pluto,
];

const PLANET_RU: Record<string, string> = {
  Mercury: 'Меркурий',
  Venus: 'Венера',
  Mars: 'Марс',
  Jupiter: 'Юпитер',
  Saturn: 'Сатурн',
  Uranus: 'Уран',
  Neptune: 'Нептун',
  Pluto: 'Плутон',
};

const ZODIAC_RU = [
  'Овен',
  'Телец',
  'Близнецы',
  'Рак',
  'Лев',
  'Дева',
  'Весы',
  'Скорпион',
  'Стрелец',
  'Козерог',
  'Водолей',
  'Рыбы',
] as const;

const QUARTER_RU = ['Новолуние', 'Первая четверть', 'Полнолуние', 'Последняя четверть'] as const;

function phaseSectorLabel(elongDeg: number): string {
  const e = norm360(elongDeg);
  if (e < 22.5 || e >= 337.5) return 'Новолуние (окрестность)';
  if (e < 67.5) return 'Рост к первой четверти';
  if (e < 112.5) return 'Первая четверть (окрестность)';
  if (e < 157.5) return 'Рост к полнолунию';
  if (e < 202.5) return 'Полнолуние (окрестность)';
  if (e < 247.5) return 'Убывание после полнолуния';
  if (e < 292.5) return 'Последняя четверть (окрестность)';
  return 'Убывание к новолунию';
}

const CHALDEAN: Astronomy.Body[] = [
  Astronomy.Body.Saturn,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Mars,
  Astronomy.Body.Sun,
  Astronomy.Body.Venus,
  Astronomy.Body.Mercury,
  Astronomy.Body.Moon,
];

/** Индекс планеты Chaldean для первого дневного часа после восхода: Вс…Сб */
const FIRST_HOUR_IDX: number[] = [3, 6, 2, 5, 1, 4, 0];

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function formatRuTime(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function startLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function planetRu(body: Astronomy.Body): string {
  return PLANET_RU[String(body)] ?? String(body);
}

function tropicalSignFromLon(lonDeg: number): string {
  const i = Math.floor(norm360(lonDeg) / 30) % 12;
  return ZODIAC_RU[i];
}

export function isPlanetRetrograde(body: Astronomy.Body, d: Date): boolean {
  const dt = 8 * 3600000;
  const l0 = norm360(geocentricPlanetEclipticLongitudeDeg(body, d));
  const l1 = norm360(geocentricPlanetEclipticLongitudeDeg(body, new Date(d.getTime() + dt)));
  let dlon = l1 - l0;
  if (dlon > 180) dlon -= 360;
  if (dlon < -180) dlon += 360;
  return dlon < 0;
}

export type MoonRiseSet = { rise: Date | null; set: Date | null };

export function computeMoonRiseSet(date: Date, observer: Astronomy.Observer): MoonRiseSet {
  const day0 = startLocalDay(date);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, +1, day0, 1.6);
  if (!rise) return { rise: null, set: null };
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, rise.date, 1.6);
  return { rise: rise.date, set: set?.date ?? null };
}

export function computeSunRiseSet(date: Date, observer: Astronomy.Observer): { rise: Date | null; set: Date | null } {
  const day0 = startLocalDay(date);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, day0, 1.6);
  if (!rise) return { rise: null, set: null };
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, rise.date, 1.6);
  return { rise: rise.date, set: set?.date ?? null };
}

export type PlanetaryHourInfo = {
  sunrise: Date | null;
  sunset: Date | null;
  label: string;
  rulerRu: string;
};

export function computePlanetaryHourNow(date: Date, observer: Astronomy.Observer): PlanetaryHourInfo {
  const { rise, set } = computeSunRiseSet(date, observer);
  if (!rise || !set) {
    return {
      sunrise: rise,
      sunset: set,
      label: 'Восход/закат для этой даты не рассчитаны.',
      rulerRu: '—',
    };
  }
  const dow = date.getDay();
  const firstIdx = FIRST_HOUR_IDX[dow] ?? 0;
  const dayMs = set.getTime() - rise.getTime();
  if (dayMs <= 0) {
    return { sunrise: rise, sunset: set, label: 'Некорректный интервал дня для планетарных часов.', rulerRu: '—' };
  }
  const t = date.getTime();
  if (t >= rise.getTime() && t < set.getTime()) {
    const part = (t - rise.getTime()) / dayMs;
    const h = Math.min(11, Math.max(0, Math.floor(part * 12)));
    const ruler = CHALDEAN[(firstIdx + h) % 7];
    return {
      sunrise: rise,
      sunset: set,
      label: `Дневной час ${h + 1}/12.`,
      rulerRu: planetRu(ruler),
    };
  }
  const nextRise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, set, 1.2);
  const nightEnd = nextRise?.date ?? new Date(set.getTime() + 12 * 3600000);
  const nightMs = nightEnd.getTime() - set.getTime();
  if (nightMs <= 0) {
    return { sunrise: rise, sunset: set, label: 'Ночной интервал слишком короткий для расчёта.', rulerRu: '—' };
  }
  const lastDayHourIdx = (firstIdx + 11) % 7;
  const firstNightIdx = (lastDayHourIdx + 1) % 7;
  if (t >= set.getTime() && t < nightEnd.getTime()) {
    const part = (t - set.getTime()) / nightMs;
    const h = Math.min(11, Math.max(0, Math.floor(part * 12)));
    const ruler = CHALDEAN[(firstNightIdx + h) % 7];
    return {
      sunrise: rise,
      sunset: set,
      label: `Ночной планетарный час ${h + 1} из 12 (после заката).`,
      rulerRu: planetRu(ruler),
    };
  }
  return {
    sunrise: rise,
    sunset: set,
    label: 'Сейчас до ближайшего восхода Солнца — считаем как хвост ночи предыдущих суток.',
    rulerRu: planetRu(CHALDEAN[(firstIdx + 11 + 1 + 11) % 7]),
  };
}

export type LunarQuarterEvent = { name: string; time: Date };

export function bracketMoonQuarters(date: Date): { prev: LunarQuarterEvent | null; next: LunarQuarterEvent | null } {
  let mq = Astronomy.SearchMoonQuarter(new Date(date.getTime() - 40 * 86400000));
  const events: LunarQuarterEvent[] = [];
  for (let i = 0; i < 18; i++) {
    events.push({ name: QUARTER_RU[mq.quarter as 0 | 1 | 2 | 3], time: mq.time.date });
    mq = Astronomy.NextMoonQuarter(mq);
    if (mq.time.date.getTime() > date.getTime() + 150 * 86400000) break;
  }
  let prev: LunarQuarterEvent | null = null;
  let next: LunarQuarterEvent | null = null;
  for (const ev of events) {
    if (ev.time.getTime() <= date.getTime()) prev = ev;
    if (ev.time.getTime() > date.getTime()) {
      next = ev;
      break;
    }
  }
  return { prev, next };
}

function lunarEclipseKindRu(k: Astronomy.EclipseKind): string {
  switch (k) {
    case Astronomy.EclipseKind.Penumbral:
      return 'полутеневое';
    case Astronomy.EclipseKind.Partial:
      return 'частное';
    case Astronomy.EclipseKind.Total:
      return 'полное';
    default:
      return 'затмение';
  }
}

function solarEclipseKindRu(k: Astronomy.EclipseKind): string {
  switch (k) {
    case Astronomy.EclipseKind.Partial:
      return 'частное';
    case Astronomy.EclipseKind.Annular:
      return 'кольцевое';
    case Astronomy.EclipseKind.Total:
      return 'полное';
    default:
      return 'солнечное';
  }
}

export type LunarReferencePack = {
  phaseLabel: string;
  illuminationPct: number;
  moonRiseSet: MoonRiseSet;
  quarters: { prev: LunarQuarterEvent | null; next: LunarQuarterEvent | null };
  nextLunarEclipse: { peak: Date; kindRu: string } | null;
  nextSolarEclipse: { peak: Date; kindRu: string } | null;
  nextPerigee: { time: Date; distKm: number } | null;
  nextApogee: { time: Date; distKm: number } | null;
  seasons: { mar: Date; jun: Date; sep: Date; dec: Date };
  moonSignIngressApprox: Date | null;
  supermoonHint: string | null;
};

const AU_KM = 149597870.7;

function moonDistanceKm(d: Date): number {
  const v = Astronomy.GeoVector(Astronomy.Body.Moon, d, true);
  return v.Length() * AU_KM;
}

function findMoonSignIngressApprox(start: Date): Date | null {
  const step = 20 * 60 * 1000;
  const limit = start.getTime() + 4 * 86400000;
  let prevLon = norm360(geocentricMoonEclipticLongitudeDeg(start));
  let prevSign = Math.floor(prevLon / 30);
  for (let t = start.getTime() + step; t <= limit; t += step) {
    const lon = norm360(geocentricMoonEclipticLongitudeDeg(new Date(t)));
    const s = Math.floor(lon / 30);
    if (s !== prevSign) {
      return new Date(t - step / 2);
    }
  }
  return null;
}

export function computeLunarReferencePack(date: Date, observer: Astronomy.Observer): LunarReferencePack {
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const elong = norm360(Astronomy.PairLongitude(Astronomy.Body.Moon, Astronomy.Body.Sun, date));
  const phaseLabel = phaseSectorLabel(elong);

  const moonRiseSet = computeMoonRiseSet(date, observer);
  const quarters = bracketMoonQuarters(date);

  let lunarEc = Astronomy.SearchLunarEclipse(new Date(date.getTime() - 400 * 86400000));
  for (let i = 0; i < 40 && lunarEc.peak.date <= date; i++) {
    lunarEc = Astronomy.NextLunarEclipse(lunarEc.peak);
  }
  const nextLunarEclipse =
    lunarEc.peak.date > date ? { peak: lunarEc.peak.date, kindRu: lunarEclipseKindRu(lunarEc.kind) } : null;

  let solarEc = Astronomy.SearchGlobalSolarEclipse(new Date(date.getTime() - 400 * 86400000));
  for (let i = 0; i < 40 && solarEc.peak.date <= date; i++) {
    solarEc = Astronomy.NextGlobalSolarEclipse(solarEc.peak);
  }
  const nextSolarEclipse =
    solarEc.peak.date > date ? { peak: solarEc.peak.date, kindRu: solarEclipseKindRu(solarEc.kind) } : null;

  let ap = Astronomy.SearchLunarApsis(Astronomy.MakeTime(new Date(date.getTime() - 60 * 86400000)));
  for (let i = 0; i < 30 && ap.time.date <= date; i++) {
    ap = Astronomy.NextLunarApsis(ap);
  }
  const ap2 = Astronomy.NextLunarApsis(ap);
  const nextPerigeeFinal =
    ap.kind === Astronomy.ApsisKind.Pericenter
      ? { time: ap.time.date, distKm: ap.dist_au * AU_KM }
      : ap2.kind === Astronomy.ApsisKind.Pericenter
        ? { time: ap2.time.date, distKm: ap2.dist_au * AU_KM }
        : null;
  const nextApogeeFinal =
    ap.kind === Astronomy.ApsisKind.Apocenter
      ? { time: ap.time.date, distKm: ap.dist_au * AU_KM }
      : ap2.kind === Astronomy.ApsisKind.Apocenter
        ? { time: ap2.time.date, distKm: ap2.dist_au * AU_KM }
        : null;

  const y = date.getFullYear();
  const s = Astronomy.Seasons(y);

  const full = Astronomy.SearchMoonPhase(180, date, 60);
  let supermoonHint: string | null = null;
  if (full) {
    const dKm = moonDistanceKm(full.date);
    if (dKm < 367_000) {
      supermoonHint = `Ближайшее полнолуние ${formatRuTime(full.date)} — суперлуние (Луна близко к Земле, ~${Math.round(dKm)} км).`;
    } else if (dKm > 404_000) {
      supermoonHint = `Ближайшее полнолуние ${formatRuTime(full.date)} — «микро»-полнолуние (дальняя Луна, ~${Math.round(dKm)} км).`;
    }
  }

  return {
    phaseLabel,
    illuminationPct: Math.round(ill.phase_fraction * 1000) / 10,
    moonRiseSet,
    quarters,
    nextLunarEclipse,
    nextSolarEclipse,
    nextPerigee: nextPerigeeFinal,
    nextApogee: nextApogeeFinal,
    seasons: { mar: s.mar_equinox.date, jun: s.jun_solstice.date, sep: s.sep_equinox.date, dec: s.dec_solstice.date },
    moonSignIngressApprox: findMoonSignIngressApprox(date),
    supermoonHint,
  };
}

export type PlanetRow = {
  body: Astronomy.Body;
  nameRu: string;
  signRu: string;
  retro: boolean;
};

export function computePlanetaryRows(date: Date): PlanetRow[] {
  return PLANETS.map((body) => ({
    body,
    nameRu: planetRu(body),
    signRu: tropicalSignFromLon(geocentricPlanetEclipticLongitudeDeg(body, date)),
    retro: isPlanetRetrograde(body, date),
  }));
}

const SCENARIOS = {
  work: [
    'Одна задача до конца — день за фокус.',
    'Списки и сроки, без лишних совещаний.',
    'Переговоры: один тезис, ясное предложение.',
  ],
  rest: [
    'Пауза без экрана 20–30 минут.',
    'Сон и прогулка важнее срочной задачи.',
    'Лёгкий режим: музыка, душ, без новых стимулов.',
  ],
  relations: [
    'Говорите коротко и спокойно.',
    'Неформальная встреча без жёсткой повестки.',
    'Задел — один честный шаг навстречу.',
  ],
  finance: [
    'Крупные траты — когда уверены в цифрах.',
    'Проверьте подписки и мелкие списания.',
    'Документы — перечитайте по пунктам.',
  ],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export type ScenarioPack = { work: string; rest: string; relations: string; finance: string };

export function computeScenarioPack(date: Date, dash: MoonDashboard): ScenarioPack {
  const seed = date.getDate() * 31 + date.getMonth() * 7 + dash.lunarDay * 13 + Math.floor(dash.moonPhaseDeg);
  return {
    work: pick(SCENARIOS.work, seed),
    rest: pick(SCENARIOS.rest, seed + 1),
    relations: pick(SCENARIOS.relations, seed + 2),
    finance: pick(SCENARIOS.finance, seed + 3),
  };
}

export function computeDailyLunarInterpretation(date: Date, dash: MoonDashboard): string {
  const wax = dash.waxing ? 'растущая' : 'убывающая';
  const phase = dash.moonPhaseDeg < 22.5 || dash.moonPhaseDeg > 337.5 ? 'в зоне новолуния' : '';
  const nearFull = dash.phaseFraction > 0.92 || dash.phaseFraction < 0.08;
  const tail = nearFull ? ' Одна тема до финала.' : ' Не распыляйтесь — одна линия дня.';
  const dayLine = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
  return `${dayLine}: Луна ${wax}, ~${Math.round(dash.phaseFraction * 100)}%, ${dash.lunarDay}-й день. В ${dash.moonSignRuPrep} ${dash.tropicalSym}.${phase}${tail}`;
}
