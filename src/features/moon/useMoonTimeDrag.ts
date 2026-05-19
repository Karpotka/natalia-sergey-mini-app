import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  moonDragApplyMove,
  moonDragExceededTap,
  moonDragSessionStart,
  moonDragTimeDeltaMs,
  moonDragVelocityPxPerMs,
  MOON_DRAG_INERTIA_FRICTION,
  MOON_DRAG_INERTIA_STOP_PX_PER_MS,
  type MoonDragSession,
} from './moonTimeDrag';

type Options = {
  getTime: () => Date;
  setTime: (d: Date) => void;
};

/**
 * Горизонтальный скролл времени луной: медленное ведение — плавно и точно,
 * быстрый свайп — ускоренный сдвиг; после отпускания — лёгкая инерция.
 */
export function useMoonTimeDrag({ getTime, setTime }: Options) {
  const sessionRef = useRef<MoonDragSession | null>(null);
  const didDragRef = useRef(false);
  const lastVelocityRef = useRef(0);
  const inertiaRafRef = useRef<number | null>(null);
  const getTimeRef = useRef(getTime);
  const setTimeRef = useRef(setTime);

  getTimeRef.current = getTime;
  setTimeRef.current = setTime;

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current != null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      stopInertia();
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const t = getTimeRef.current();
      sessionRef.current = moonDragSessionStart(e.clientX, e.clientY, t.getTime());
      lastVelocityRef.current = 0;
      didDragRef.current = false;
    },
    [stopInertia],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = sessionRef.current;
    if (!s) return;

    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (moonDragExceededTap(dx, dy)) didDragRef.current = true;

    const prevX = s.lastX;
    const prevAt = s.lastMoveAt;
    const next = moonDragApplyMove(s, e.clientX);
    sessionRef.current = next;

    const dtMs = Math.max(next.lastMoveAt - prevAt, 8);
    lastVelocityRef.current = moonDragVelocityPxPerMs(e.clientX - prevX, dtMs);

    if (!Number.isNaN(next.timeMs)) setTimeRef.current(new Date(next.timeMs));
  }, []);

  const startInertia = useCallback(() => {
    let velocity = lastVelocityRef.current;
    if (Math.abs(velocity) < MOON_DRAG_INERTIA_STOP_PX_PER_MS) return;

    let lastT = performance.now();

    const tick = () => {
      const now = performance.now();
      const dtMs = Math.max(now - lastT, 8);
      lastT = now;

      const dxStep = velocity * dtMs;
      const deltaMs = moonDragTimeDeltaMs(dxStep, dtMs);
      const t = getTimeRef.current().getTime() + deltaMs;
      if (Number.isFinite(t)) setTimeRef.current(new Date(t));

      velocity *= MOON_DRAG_INERTIA_FRICTION;
      if (Math.abs(velocity) < MOON_DRAG_INERTIA_STOP_PX_PER_MS) {
        inertiaRafRef.current = null;
        return;
      }

      inertiaRafRef.current = requestAnimationFrame(tick);
    };

    inertiaRafRef.current = requestAnimationFrame(tick);
  }, []);

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const hadSession = sessionRef.current != null;
      const wasDrag = didDragRef.current;
      sessionRef.current = null;
      if (hadSession && wasDrag) startInertia();
    },
    [startInertia],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      endPointer(e);
    },
    [endPointer],
  );

  const onPointerCancel = onPointerUp;

  const consumeWasTap = useCallback(() => {
    const tap = !didDragRef.current;
    didDragRef.current = false;
    return tap;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeWasTap,
  };
};
