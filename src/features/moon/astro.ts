import * as Astronomy from 'astronomy-engine';

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

const ZODIAC_SYM = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] as const;

/** Падеж «где?» для заголовка «Луна в …» (тропический знак, как в обычных лунных гороскопах). */
export const ZODIAC_MOON_IN_PREP = [
  'Овне',
  'Тельце',
  'Близнецах',
  'Раке',
  'Льве',
  'Деве',
  'Весах',
  'Скорпионе',
  'Стрельце',
  'Козероге',
  'Водолее',
  'Рыбах',
] as const;

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Геоцентрическая эклиптическая долгота Луны (тропик, плоскость и весна даты), [0, 360)°.
 * Важно: `EclipticLongitude(Body.Moon)` в astronomy-engine — **гелиоцентрик** (орбита Луны вокруг Солнца),
 * для «Луна в знаке» и сидерики нужен именно геоцентрический эклиптический долготный угол.
 */
export function geocentricMoonEclipticLongitudeDeg(date: Date): number {
  return normalizeDeg(Astronomy.EclipticGeoMoon(date).lon);
}

/**
 * Геоцентрическая эклиптическая долгота планеты (тропик, истинная эклиптика даты), [0, 360)°.
 * Важно: `Astronomy.EclipticLongitude` для планет — **гелиоцентрик**; ретроградность и «знак с Земли»
 * считаются по геоцентрическому кажущемуся движению.
 */
export function geocentricPlanetEclipticLongitudeDeg(body: Astronomy.Body, date: Date): number {
  const eqj = Astronomy.GeoVector(body, date, true);
  const ecl = Astronomy.Ecliptic(eqj);
  return normalizeDeg(ecl.elon);
}

/**
 * Геоцентрическая элонгация Луны относительно Солнца по эклиптике: λ(Луна) − λ(Солнце), [0, 360)°.
 */
function lunarElongationDeg(date: Date): number {
  return normalizeDeg(Astronomy.PairLongitude(Astronomy.Body.Moon, Astronomy.Body.Sun, date));
}

function tithiIndexFromElongation(elongDeg: number): number {
  const e = normalizeDeg(elongDeg);
  const raw = Math.floor(e / 12) + 1;
  return Math.min(30, Math.max(1, raw));
}

/** Lahiri ayanamsa (°): ~23.85° у J2000 + ~50.29″/год. */
function lahiriAyanamsaDeg(date: Date): number {
  const jd = 2440587.5 + date.getTime() / 86400000;
  const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
  return 23.85 + yearsFromJ2000 * (50.29 / 3600);
}

/**
 * Лунный день 1…30 от предыдущего астрономического новолуния до следующего
 * (равные доли синодического месяца — как в классических лунных календарях Deluxe Moon).
 */
function lunationDayIndex(date: Date, elongDeg: number): number {
  const prev = Astronomy.SearchMoonPhase(0, date, -55);
  if (!prev) return tithiIndexFromElongation(elongDeg);
  const afterPrev = new Date(prev.date.getTime() + 120_000);
  const next = Astronomy.SearchMoonPhase(0, afterPrev, 40);
  if (!next) return tithiIndexFromElongation(elongDeg);
  const span = next.date.getTime() - prev.date.getTime();
  const elapsed = date.getTime() - prev.date.getTime();
  if (span <= 0 || elapsed <= 0) return 1;
  const idx = Math.floor((elapsed / span) * 30) + 1;
  return Math.min(30, Math.max(1, idx));
}

export type MoonDashboard = {
  moonPhaseDeg: number;
  phaseFraction: number;
  waxing: boolean;
  /** Индийская титхи 1…30 по шагу элонгации 12° (для справочных панелей). */
  tithi: number;
  /** Лунный день 1…30 от новолуния до новолуния (для карточек и базы `forecast_ru`). */
  lunarDay: number;
  /** «Лунная стоянка» 1–28 по сидерической долготе Луны. */
  lunarStation28: number;
  tropicalSignIndex: number;
  siderealSignIndex: number;
  nakshatra: number;
  tropicalName: string;
  tropicalSym: string;
  siderealName: string;
  siderealSym: string;
  /** Для заголовка «Луна в …» — падеж тропического знака (геоцентрическая Луна). */
  moonSignRuPrep: string;
};

export function computeMoonDashboard(date: Date): MoonDashboard {
  const moonPhaseDeg = lunarElongationDeg(date);
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const moonLonNorm = geocentricMoonEclipticLongitudeDeg(date);
  const sidereal = normalizeDeg(moonLonNorm - lahiriAyanamsaDeg(date));

  const tithi = tithiIndexFromElongation(moonPhaseDeg);
  const lunarDay = lunationDayIndex(date, moonPhaseDeg);
  const tropicalSignIndex = Math.floor(moonLonNorm / 30) % 12;
  const siderealSignIndex = Math.floor(sidereal / 30) % 12;
  const nakshatra = Math.floor(sidereal / (360 / 27)) + 1;
  const lunarStation28 = Math.floor(sidereal / (360 / 28)) + 1;

  return {
    moonPhaseDeg,
    phaseFraction: ill.phase_fraction,
    waxing: moonPhaseDeg < 180,
    tithi: Math.min(30, Math.max(1, tithi)),
    lunarDay: Math.min(30, Math.max(1, lunarDay)),
    lunarStation28: Math.min(28, Math.max(1, lunarStation28)),
    tropicalSignIndex,
    siderealSignIndex,
    nakshatra: Math.min(27, Math.max(1, nakshatra)),
    tropicalName: ZODIAC_RU[tropicalSignIndex],
    tropicalSym: ZODIAC_SYM[tropicalSignIndex],
    siderealName: ZODIAC_RU[siderealSignIndex],
    siderealSym: ZODIAC_SYM[siderealSignIndex],
    moonSignRuPrep: ZODIAC_MOON_IN_PREP[tropicalSignIndex],
  };
}
