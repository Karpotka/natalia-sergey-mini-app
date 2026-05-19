import { useEffect, useState } from 'react';
import {
  grayMoonUrl,
  MOON_GRAY_FRAME_FILES,
  MOON_GRAY_PROBE_FILE,
  moonGrayBlend,
} from './moonPhases';

type Props = {
  moonPhaseDeg: number;
  size: number;
  fallbackSrc: string;
};

/**
 * Луна из экспорта Assets: gray_mb0_Normal … gray_mb120w_Normal (182 кадра),
 * плавный переход между соседними при смене фазы / скролле времени.
 */
export function MoonPhaseView({ moonPhaseDeg, size, fallbackSrc }: Props) {
  const [catalogOk, setCatalogOk] = useState<boolean | null>(null);
  const { nameA, nameB, t } = moonGrayBlend(moonPhaseDeg);

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setCatalogOk(true);
    };
    probe.onerror = () => {
      if (!cancelled) setCatalogOk(false);
    };
    probe.src = grayMoonUrl(MOON_GRAY_PROBE_FILE);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (catalogOk !== true) return;
    let cancelled = false;
    let i = 0;
    const chunk = 18;

    const step = () => {
      if (cancelled) return;
      const end = Math.min(i + chunk, MOON_GRAY_FRAME_FILES.length);
      for (; i < end; i++) {
        const im = new Image();
        im.src = grayMoonUrl(MOON_GRAY_FRAME_FILES[i]);
      }
      if (i < MOON_GRAY_FRAME_FILES.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(step, { timeout: 4000 });
        } else {
          setTimeout(step, 0);
        }
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(step, { timeout: 4000 });
    } else {
      step();
    }

    return () => {
      cancelled = true;
    };
  }, [catalogOk]);

  useEffect(() => {
    if (catalogOk !== true) return;
    const preload = (filename: string) => {
      const im = new Image();
      im.src = grayMoonUrl(filename);
    };
    preload(nameA);
    preload(nameB);
    const iA = MOON_GRAY_FRAME_FILES.indexOf(nameA);
    const iB = MOON_GRAY_FRAME_FILES.indexOf(nameB);
    for (const i of [iA, iB]) {
      if (i < 0) continue;
      for (let d = -3; d <= 3; d++) {
        const j = i + d;
        if (j >= 0 && j < MOON_GRAY_FRAME_FILES.length) preload(MOON_GRAY_FRAME_FILES[j]);
      }
    }
  }, [catalogOk, nameA, nameB]);

  const frameClass = 'moon-phase-frame' + (catalogOk !== null ? ' moon-phase-frame--blend' : '');
  const frameBox = { width: size, height: size } as const;

  if (catalogOk === false) {
    return (
      <div className="moon-phase-frame moon-phase-frame--blend" style={frameBox}>
        <div className="moon-phase-fallback" style={{ width: '100%', height: '100%' }}>
          <img src={fallbackSrc} alt="" className="moon-phase-fallback-img" decoding="async" />
        </div>
      </div>
    );
  }

  return (
    <div className={frameClass} style={frameBox}>
      <div className="moon-phase-stack" style={{ width: '100%', height: '100%' }} aria-hidden>
        {catalogOk === true && (
          <>
            <img
              src={grayMoonUrl(nameA)}
              alt=""
              className="moon-phase-layer"
              style={{ opacity: 1 - t }}
              decoding="async"
              draggable={false}
            />
            <img
              src={grayMoonUrl(nameB)}
              alt=""
              className="moon-phase-layer"
              style={{ opacity: t }}
              decoding="async"
              draggable={false}
            />
          </>
        )}
        {catalogOk === null && <div className="moon-phase-loading" style={{ width: '100%', height: '100%' }} />}
      </div>
    </div>
  );
}
