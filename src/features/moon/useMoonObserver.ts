import * as Astronomy from 'astronomy-engine';
import { useEffect, useMemo } from 'react';
import { MOSCOW_OBSERVER_HEIGHT_M, MOSCOW_OBSERVER_LAT, MOSCOW_OBSERVER_LON } from './moonCalendars';

const STORAGE_KEY = 'ns-moon-geo-v1';

function moscowObserver(): Astronomy.Observer {
  return new Astronomy.Observer(MOSCOW_OBSERVER_LAT, MOSCOW_OBSERVER_LON, MOSCOW_OBSERVER_HEIGHT_M);
}

/**
 * Точка наблюдения для горизонта / планетарных часов — всегда Москва (без геолокации).
 */
export function useMoonObserver() {
  const observer = useMemo(() => moscowObserver(), []);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
  }, []);

  return {
    observer,
    source: 'default' as const,
    busy: false,
    lastMessage: null as string | null,
    isVkClient: false,
    observerLabel: 'Москва',
    observerCoordsHint: null as string | null,
  };
}
