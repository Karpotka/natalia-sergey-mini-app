import { startTransition, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConsultationsPage } from '../pages/ConsultationsPage';
// Раздел «Обучение» временно скрыт — вернуть импорт и блок панели ниже, когда будет готово.
// import { EducationPage } from '../pages/EducationPage';
import { HoroscopePage } from '../pages/HoroscopePage';
import { MoonPage } from '../pages/MoonPage';
import { ProfilePage } from '../pages/ProfilePage';
import { TarotPage } from '../pages/TarotPage';
import { ProductNavRailIcon } from './ProductNavRailIcon';
import { PRODUCT_PANEL_IDS, type ProductPanelId } from './productPanelIds';

export type { ProductPanelId } from './productPanelIds';

const PANELS = PRODUCT_PANEL_IDS;

const LABELS: Record<ProductPanelId, string> = {
  moon: 'Главная',
  horoscope: 'Календарь',
  tarot: 'Практики',
  consult: 'Таро',
  profile: 'Профиль',
};

export function readProductPanel(searchParams: URLSearchParams): ProductPanelId {
  const s = searchParams.get('panel');
  if (s === 'runes') return 'consult';
  if (s === 'learn' || s === 'education') return 'moon';
  if (s && (PANELS as readonly string[]).includes(s)) return s as ProductPanelId;
  return 'moon';
}

function indexOfPanel(p: ProductPanelId) {
  return PANELS.indexOf(p);
}

function setPanelParams(prev: URLSearchParams, next: ProductPanelId) {
  const p = new URLSearchParams(prev);
  if (next === 'moon') p.delete('panel');
  else p.set('panel', next);
  return p;
}

export function ProductPager() {
  const [search, setSearchParams] = useSearchParams();
  const panel = readProductPanel(search);
  const activeIndex = indexOfPanel(panel);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  useLayoutEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const apply = () => {
      const w = root.clientWidth;
      if (w <= 0) return;
      root.scrollTo({ left: activeIndex * w, behavior: 'auto' });
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [activeIndex]);

  useLayoutEffect(() => {
    const nav = railRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLButtonElement>('.pager-rail-btn.is-active');
    active?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, [panel]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const sync = () => {
      const w = root.clientWidth;
      if (w <= 0) return;
      const i = Math.round(root.scrollLeft / w);
      const clamped = Math.min(PANELS.length - 1, Math.max(0, i));
      const next = PANELS[clamped];
      if (next !== panelRef.current) {
        startTransition(() => {
          setSearchParams((prev) => setPanelParams(prev, next), { replace: true });
        });
      }
    };

    root.addEventListener('scrollend', sync);

    /** iOS / старые WebKit без `scrollend`: один раз после жеста синхронизируем URL. */
    let touchEndTimer: ReturnType<typeof setTimeout> | undefined;
    const onTouchEnd = () => {
      window.clearTimeout(touchEndTimer);
      touchEndTimer = window.setTimeout(() => {
        touchEndTimer = undefined;
        requestAnimationFrame(() => {
          requestAnimationFrame(sync);
        });
      }, 80);
    };
    root.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      root.removeEventListener('scrollend', sync);
      root.removeEventListener('touchend', onTouchEnd);
      window.clearTimeout(touchEndTimer);
    };
  }, [setSearchParams]);

  const goToIndex = useCallback(
    (i: number) => {
      const next = PANELS[Math.min(PANELS.length - 1, Math.max(0, i))];
      startTransition(() => {
        setSearchParams((prev) => setPanelParams(prev, next), { replace: true });
      });
    },
    [setSearchParams],
  );

  return (
    <div className="pager-root" data-active-panel={panel}>
      <div
        ref={scrollerRef}
        className="product-pager"
        role="region"
        aria-roledescription="carousel"
        aria-label="Разделы приложения, листайте вправо"
      >
        <section
          className="product-panel product-panel--moon"
          aria-roledescription="slide"
          aria-label={LABELS.moon}
        >
          <div className="product-panel-inner product-panel-inner--moon">
            <MoonPage />
          </div>
        </section>
        <section className="product-panel product-panel--horoscope" aria-label={LABELS.horoscope}>
          <div className="product-panel-inner">
            <HoroscopePage />
          </div>
        </section>
        <section className="product-panel product-panel--tarot" aria-label={LABELS.tarot}>
          <div className="product-panel-inner">
            <ConsultationsPage />
          </div>
        </section>
        {/*
        <section className="product-panel product-panel--learn" aria-label="Обучение">
          <div className="product-panel-inner">
            <EducationPage />
          </div>
        </section>
        */}
        <section className="product-panel product-panel--consult" aria-label={LABELS.consult}>
          <div className="product-panel-inner">
            <TarotPage />
          </div>
        </section>
        <section className="product-panel product-panel--profile" aria-label={LABELS.profile}>
          <div className="product-panel-inner">
            <ProfilePage />
          </div>
        </section>
      </div>

      <nav ref={railRef} className="pager-rail" aria-label="Нижняя навигация">
        {PANELS.map((id) => {
          const i = indexOfPanel(id);
          const isActive = panel === id;
          return (
            <button
              key={id}
              type="button"
              className={`pager-rail-btn${isActive ? ' is-active' : ''}`}
              onClick={() => goToIndex(i)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="pager-rail-icon" aria-hidden>
                <ProductNavRailIcon id={id} active={isActive} />
              </span>
              <span className="pager-rail-label">{LABELS[id]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
