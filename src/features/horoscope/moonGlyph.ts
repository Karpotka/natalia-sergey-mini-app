import { computeMoonDashboard } from '../moon/astro';

/** Упрощённая визуализация фазы для ячейки календаря (как в Runes_test / Moonly). */
export function moonPhaseEmojiForDate(d: Date): string {
  const { phaseFraction, waxing } = computeMoonDashboard(d);
  const f = phaseFraction;
  if (f < 0.03) return '🌑';
  if (f < 0.22) return waxing ? '🌒' : '🌘';
  if (f < 0.47) return waxing ? '🌓' : '🌗';
  if (f < 0.53) return '🌔';
  if (f < 0.78) return waxing ? '🌔' : '🌖';
  if (f < 0.97) return waxing ? '🌕' : '🌖';
  return '🌕';
}
