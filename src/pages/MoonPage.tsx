import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { computeMoonDashboard } from '../features/moon/astro';
import { moondayCharacteristicsFromDbAsync } from '../features/moon/moonForecastCopy';
import {
  computeDailyLunarInterpretation,
  computeLunarReferencePack,
  computePlanetaryHourNow,
  computePlanetaryRows,
  computeScenarioPack,
} from '../features/moon/moonCalendars';
import { useMoonObserver } from '../features/moon/useMoonObserver';
import { AppBackground } from '../components/AppBackground';
import quickConsultImg from '../assets/home-quick/quick-consult.png';
import quickDayCardImg from '../assets/home-quick/quick-day-card.png';
import quickHoroscopeImg from '../assets/home-quick/quick-horoscope.png';
import quickSpreadImg from '../assets/home-quick/quick-spread.png';
import { MoonCalculationsPanels, MOON_SLIDE_COUNT } from '../features/moon/MoonCalculationsPanels';
import { grayMoonUrl, MOON_GRAY_PROBE_FILE } from '../features/moon/moonPhases';
import { MoonPhaseView } from '../features/moon/MoonPhaseView';
import { useMoonTimeDrag } from '../features/moon/useMoonTimeDrag';
import '../features/moon/moonSurface.css';

const MOON_FALLBACK = grayMoonUrl(MOON_GRAY_PROBE_FILE);

/** Короткие «настроения» по тропическому знаку Луны — для строки тегов на главной. */
const MOON_SIGN_TAGS: readonly string[] = [
  'Импульс • Старт • Ясность',
  'Опора • Чувства • Терпение',
  'Связь • Слова • Любопытство',
  'Забота • Дом • Интуиция',
  'Свет • Уверенность • Игра',
  'Порядок • Детали • Забота',
  'Баланс • Отношения • Вкус',
  'Глубина • Интуиция • Трансформация',
  'Смысл • Даль • Свобода',
  'Цель • Структура • Ответственность',
  'Идеи • Друзья • Обновление',
  'Сострадание • Сон • Отпускание',
];

function greetingRu(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 17) return 'Добрый день';
  if (hour >= 17 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

function formatRuDateParts(d: Date): { datePart: string; timePart: string } {
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { datePart, timePart };
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function mergeIsoDateIntoDate(base: Date, isoDate: string): Date {
  const parts = isoDate.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return base;
  const [y, mo, day] = parts;
  const next = new Date(base);
  next.setFullYear(y, mo - 1, day);
  return next;
}

function mergeTimeIntoDate(base: Date, timeHm: string): Date {
  const parts = timeHm.split(':').map((x) => parseInt(x, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return base;
  const [h, min] = parts;
  const next = new Date(base);
  next.setHours(h, min, 0, 0);
  return next;
}

export function MoonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useProfile();
  const [now, setNow] = useState(() => new Date());
  const [moonSize, setMoonSize] = useState(72);
  const [immersiveMoonSize, setImmersiveMoonSize] = useState(240);
  const [moonImmersiveOpen, setMoonImmersiveOpen] = useState(false);
  const [moonSlide, setMoonSlide] = useState(0);
  const moonObserver = useMoonObserver();

  const getMoonTime = useCallback(() => now, [now]);
  const moonTimeDrag = useMoonTimeDrag({ getTime: getMoonTime, setTime: setNow });

  useEffect(() => {
    const ro = () => {
      setMoonSize(Math.min(88, Math.max(56, Math.round(window.innerWidth * 0.17))));
      setImmersiveMoonSize(
        Math.min(280, Math.max(190, Math.round(window.innerWidth * 0.62))),
      );
    };
    ro();
    window.addEventListener('resize', ro);
    return () => window.removeEventListener('resize', ro);
  }, []);

  useEffect(() => {
    if (!moonImmersiveOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoonImmersiveOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [moonImmersiveOpen]);

  const dashboard = useMemo(() => computeMoonDashboard(now), [now]);
  const dateParts = useMemo(() => formatRuDateParts(now), [now]);

  const lunarRef = useMemo(() => computeLunarReferencePack(now, moonObserver.observer), [now, moonObserver.observer]);
  const planetRows = useMemo(() => computePlanetaryRows(now), [now]);
  const planetaryHour = useMemo(
    () => computePlanetaryHourNow(now, moonObserver.observer),
    [now, moonObserver.observer],
  );
  const scenarioPack = useMemo(() => computeScenarioPack(now, dashboard), [now, dashboard]);
  const lunarInterpret = useMemo(() => computeDailyLunarInterpretation(now, dashboard), [now, dashboard]);

  const resetToNow = useCallback(() => {
    setNow(new Date());
  }, []);

  const goPanel = useCallback(
    (panel: 'horoscope' | 'tarot' | 'consult') => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (panel === 'horoscope') p.set('panel', 'horoscope');
          else if (panel === 'tarot') p.set('panel', 'tarot');
          else if (panel === 'consult') p.set('panel', 'consult');
          // else if (panel === 'learn') p.set('panel', 'learn'); // когда вернётся раздел «Обучение»
          p.delete('moon');
          p.delete('tarotDay');
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Вкладка «Таро» + экран «Карта дня» (сбрасывает расклады, если они были открыты). */
  const goTarotDayCard = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('panel', 'consult');
        p.set('tarotDay', '1');
        p.delete('moon');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const moonParam = searchParams.get('moon');

  /** Параметр `moon=detail` больше не используется в UI — очищаем из URL на любой вкладке. */
  useEffect(() => {
    if (moonParam !== 'detail') return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('moon');
        return p;
      },
      { replace: true },
    );
  }, [moonParam, setSearchParams]);

  const displayName = profile.name.trim() || 'друг';
  const greet = useMemo(() => greetingRu(now.getHours()), [now]);
  const [moonDbTeaser, setMoonDbTeaser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void moondayCharacteristicsFromDbAsync(dashboard.lunarDay).then((t) => {
      if (!cancelled) setMoonDbTeaser(t.trim() || null);
    });
    return () => {
      cancelled = true;
    };
  }, [dashboard.lunarDay]);

  const moonTags = MOON_SIGN_TAGS[dashboard.tropicalSignIndex] ?? MOON_SIGN_TAGS[0];
  const todayTeaser = useMemo(() => {
    const t = (moonDbTeaser ?? lunarInterpret).trim();
    if (t.length <= 100) return t;
    const cut = t.slice(0, 97);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 50 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }, [moonDbTeaser, lunarInterpret]);

  const nextMoonSlide = useCallback(() => {
    setMoonSlide((i) => (i + 1) % MOON_SLIDE_COUNT);
  }, []);

  const prevMoonSlide = useCallback(() => {
    setMoonSlide((i) => (i - 1 + MOON_SLIDE_COUNT) % MOON_SLIDE_COUNT);
  }, []);

  const moonPanelsPayload = useMemo(
    () => ({
      dateParts,
      now,
      setNow,
      resetToNow,
      toDateInputValue,
      toTimeInputValue,
      mergeIsoDateIntoDate,
      mergeTimeIntoDate,
      dashboard,
      moonSlide,
      prevMoonSlide,
      nextMoonSlide,
      lunarRef,
      scenarioPack,
      lunarInterpret,
      planetRows,
      planetaryHour,
    }),
    [
      dateParts,
      now,
      setNow,
      resetToNow,
      dashboard,
      moonSlide,
      prevMoonSlide,
      nextMoonSlide,
      lunarRef,
      scenarioPack,
      lunarInterpret,
      planetRows,
      planetaryHour,
    ],
  );

  const onHeroMoonPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    moonTimeDrag.onPointerUp(e);
    if (moonTimeDrag.consumeWasTap()) setMoonImmersiveOpen(true);
  };

  const onHeroMoonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setMoonImmersiveOpen(true);
    }
  };

  const immersiveLayer =
    moonImmersiveOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="moon-immersive-root"
        role="dialog"
        aria-modal="true"
        aria-label="Луна, полноэкранный режим"
      >
        <AppBackground variant="contained" />
        <div className="stars moon-immersive-stars" aria-hidden />
        <button
          type="button"
          className="moon-immersive-close"
          onClick={() => setMoonImmersiveOpen(false)}
          aria-label="Закрыть полноэкранный режим"
        >
          ←
        </button>
        <div className="moon-immersive-body moon-immersive-body--scroll">
          <section
            className="moon-section moon-section--immersive"
            onPointerDown={moonTimeDrag.onPointerDown}
            onPointerMove={moonTimeDrag.onPointerMove}
            onPointerUp={moonTimeDrag.onPointerUp}
            onPointerCancel={moonTimeDrag.onPointerCancel}
          >
            <div className="moon-glow moon-glow--immersive" aria-hidden />
            <MoonPhaseView
              moonPhaseDeg={dashboard.moonPhaseDeg}
              size={immersiveMoonSize}
              fallbackSrc={MOON_FALLBACK}
            />
          </section>
          <MoonCalculationsPanels variant="immersive" {...moonPanelsPayload} />
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="moon-root">
      <div className="stars" aria-hidden />

      {immersiveLayer}

      <main className="main-screen main-screen--home">
        <header className="home-top-bar">
          <div className="home-avatar" aria-hidden>
            {profile.name.trim() ? profile.name.trim().slice(0, 1).toUpperCase() : '★'}
          </div>
          <p className="home-greeting">
            {greet}, {displayName}
          </p>
        </header>

        <section className="home-hero" aria-label="Главный экран">
          <div className="home-hero-copy">
            <h1 className="home-hero-title">Космический компас на день</h1>
          </div>
          <div className="home-hero-moon">
            <section
              className="moon-section moon-section--hero"
              role="button"
              tabIndex={0}
              aria-label="Луна: полный экран. Тяните влево или вправо — время"
              onPointerDown={moonTimeDrag.onPointerDown}
              onPointerMove={moonTimeDrag.onPointerMove}
              onPointerUp={onHeroMoonPointerUp}
              onPointerCancel={moonTimeDrag.onPointerCancel}
              onKeyDown={onHeroMoonKeyDown}
            >
              <div className="moon-glow" aria-hidden />
              <MoonPhaseView
                moonPhaseDeg={dashboard.moonPhaseDeg}
                size={moonSize}
                fallbackSrc={MOON_FALLBACK}
              />
            </section>
            <p className="home-moon-caption" aria-hidden>
              нажми на меня
            </p>
          </div>
        </section>

        <section className="home-today" aria-labelledby="home-today-heading">
          <h2 id="home-today-heading" className="home-section-title">
            Сегодня
          </h2>
          <div className="home-today-card">
            <div className="home-today-inner">
              <div className="home-today-moon-icon" aria-hidden>
                🌙
              </div>
              <div className="home-today-body">
                <h3 className="home-today-moon-line">Луна в {dashboard.moonSignRuPrep}</h3>
                <p className="home-today-tags">{moonTags}</p>
                <p className="home-today-desc">{todayTeaser}</p>
                <button type="button" className="home-read-forecast-btn" onClick={() => goPanel('horoscope')}>
                  Прогноз <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="home-quick" aria-labelledby="home-quick-heading">
          <h2 id="home-quick-heading" className="home-section-title home-quick-section-title">
            Быстрый доступ
          </h2>
          <div className="home-quick-grid">
            <button type="button" className="home-quick-card" onClick={goTarotDayCard}>
              <span className="home-quick-icon" aria-hidden>
                <img src={quickDayCardImg} alt="" className="home-quick-icon-img" width={56} height={56} />
              </span>
              <span className="home-quick-label">Карта дня</span>
            </button>
            <button
              type="button"
              className="home-quick-card"
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev);
                    p.set('panel', 'consult');
                    p.set('pickSpread', '1');
                    p.delete('moon');
                    p.delete('tarotDay');
                    return p;
                  },
                  { replace: true },
                );
              }}
            >
              <span className="home-quick-icon" aria-hidden>
                <img src={quickSpreadImg} alt="" className="home-quick-icon-img" width={56} height={56} />
              </span>
              <span className="home-quick-label">Таро расклад</span>
            </button>
            <button type="button" className="home-quick-card" onClick={() => goPanel('tarot')}>
              <span className="home-quick-icon" aria-hidden>
                <img src={quickConsultImg} alt="" className="home-quick-icon-img" width={56} height={56} />
              </span>
              <span className="home-quick-label">Консультация</span>
            </button>
            <button type="button" className="home-quick-card" onClick={() => goPanel('horoscope')}>
              <span className="home-quick-icon" aria-hidden>
                <img src={quickHoroscopeImg} alt="" className="home-quick-icon-img" width={56} height={56} />
              </span>
              <span className="home-quick-label">Гороскоп</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
