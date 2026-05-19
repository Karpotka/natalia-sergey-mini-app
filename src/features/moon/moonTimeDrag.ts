/** Базовая чувствительность при медленном ведении (~2.5 мин/px, как Deluxe Moon). */
export const MOON_DRAG_BASE_MS_PER_PX = 2.5 * 60 * 1000;

/** @deprecated используйте MOON_DRAG_BASE_MS_PER_PX */
export const MOON_DRAG_MS_PER_PX = MOON_DRAG_BASE_MS_PER_PX;

/** Порог «это тап», а не смена времени (px). */
export const MOON_TAP_MAX_PX = 14;

/** Скорость жеста (px/ms), при которой достигается максимальное ускорение. */
export const MOON_DRAG_VELOCITY_REF_PX_PER_MS = 0.4;

/** Множитель чувствительности при быстром свайпе (медленно ≈ 1×, быстро → до этого значения). */
export const MOON_DRAG_MAX_VELOCITY_BOOST = 8;

/** Инерция после отпускания: затухание скорости за кадр. */
export const MOON_DRAG_INERTIA_FRICTION = 0.9;

/** Минимальная скорость инерции (px/ms), ниже — останавливаем. */
export const MOON_DRAG_INERTIA_STOP_PX_PER_MS = 0.05;

const MIN_DT_MS = 8;

export type MoonDragSession = {
  x0: number;
  y0: number;
  lastX: number;
  lastMoveAt: number;
  timeMs: number;
};

export function moonDragSessionStart(clientX: number, clientY: number, timeMs: number): MoonDragSession {
  const now = performance.now();
  return {
    x0: clientX,
    y0: clientY,
    lastX: clientX,
    lastMoveAt: now,
    timeMs,
  };
}

/**
 * Сдвиг времени за шаг жеста: медленно — базовая чувствительность,
 * быстрее палец — выше множитель (velocity-scaled scrubbing).
 */
export function moonDragTimeDeltaMs(dxStep: number, dtMs: number): number {
  const dt = Math.max(dtMs, MIN_DT_MS);
  const speed = Math.abs(dxStep / dt);
  const boost =
    1 + Math.min(speed / MOON_DRAG_VELOCITY_REF_PX_PER_MS, MOON_DRAG_MAX_VELOCITY_BOOST - 1);
  return -dxStep * MOON_DRAG_BASE_MS_PER_PX * boost;
}

export function moonDragVelocityPxPerMs(dxStep: number, dtMs: number): number {
  return dxStep / Math.max(dtMs, MIN_DT_MS);
}

export function moonDragApplyMove(session: MoonDragSession, clientX: number): MoonDragSession {
  const dxStep = clientX - session.lastX;
  if (dxStep === 0) return session;

  const now = performance.now();
  const dtMs = Math.max(now - session.lastMoveAt, MIN_DT_MS);
  const deltaMs = moonDragTimeDeltaMs(dxStep, dtMs);

  return {
    ...session,
    lastX: clientX,
    lastMoveAt: now,
    timeMs: session.timeMs + deltaMs,
  };
}

export function moonDragExceededTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > MOON_TAP_MAX_PX;
}
