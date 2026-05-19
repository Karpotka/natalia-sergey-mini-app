/**
 * Порядок кадров луны из Assets (gray_mb0 … gray_mb120w), как в Deluxe Moon.
 * 0, 0w, затем для n = 1…120: нечётный n — один кадр, чётный — gray_mb{n} и gray_mb{n}w.
 */
export const MOON_GRAY_FRAME_FILES: readonly string[] = (() => {
  const out: string[] = ['gray_mb0_Normal.png', 'gray_mb0w_Normal.png'];
  for (let n = 1; n <= 120; n++) {
    if (n % 2 === 1) {
      out.push(`gray_mb${n}_Normal.png`);
    } else {
      out.push(`gray_mb${n}_Normal.png`);
      out.push(`gray_mb${n}w_Normal.png`);
    }
  }
  return out;
})();

export const MOON_GRAY_FRAME_COUNT = MOON_GRAY_FRAME_FILES.length;

/** Сдвиг цикла в градусах, если кадр не совпадает с астрономической фазой */
const PHASE_DEG_OFFSET = 0;

export type GrayMoonBlend = {
  nameA: string;
  nameB: string;
  /** 0 = только A, 1 = только B */
  t: number;
};

/**
 * Синодический угол как в astronomy-engine MoonPhase: 0° новолуние, 180° полнолуние.
 * Линейная интерполяция по 182 кадрам с кроссфейдом между соседними.
 */
export function moonGrayBlend(moonPhaseDeg: number): GrayMoonBlend {
  const n = MOON_GRAY_FRAME_COUNT;
  const d = (((moonPhaseDeg + PHASE_DEG_OFFSET) % 360) + 360) % 360;
  if (n < 2) {
    const only = MOON_GRAY_FRAME_FILES[0] ?? 'gray_mb0_Normal.png';
    return { nameA: only, nameB: only, t: 0 };
  }
  const pos = (d / 360) * (n - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, n - 1);
  const t = pos - i0;
  return {
    nameA: MOON_GRAY_FRAME_FILES[i0],
    nameB: MOON_GRAY_FRAME_FILES[i1],
    t,
  };
}

/** Базовый URL статики (VK Mini Apps: base `./`) */
export function moonAssetUrl(...parts: string[]): string {
  const base = import.meta.env.BASE_URL || '/';
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}${parts.join('/')}`;
}

export function grayMoonUrl(filename: string): string {
  return moonAssetUrl('moon', 'phases', filename);
}

/** Первый кадр для проверки наличия набора */
export const MOON_GRAY_PROBE_FILE = 'gray_mb0_Normal.png';
