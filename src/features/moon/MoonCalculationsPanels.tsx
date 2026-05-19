import type { Dispatch, SetStateAction } from 'react';
import type { MoonDashboard } from './astro';
import type {
  LunarReferencePack,
  PlanetaryHourInfo,
  PlanetRow,
  ScenarioPack,
} from './moonCalendars';
import { formatRuTime } from './moonCalendars';
import { GaugeRing } from './GaugeRing';

export const MOON_SLIDE_COUNT = 6;
const MOON_SLIDE_LABELS = [
  'Тропический и сидерический',
  'Лунный прогноз',
  'Ориентиры на день',
  'Редкие события',
  'Расширенный лунный календарь',
  'Планеты и горизонт',
] as const;

export type MoonCalculationsPanelsProps = {
  variant: 'page' | 'immersive';
  /** Только для `variant="page"` (на главной вкладке Луны расчёты больше не показываем). */
  onBack?: () => void;
  backLabel?: string;
  dateParts: { datePart: string; timePart: string };
  now: Date;
  setNow: Dispatch<SetStateAction<Date>>;
  resetToNow: () => void;
  toDateInputValue: (d: Date) => string;
  toTimeInputValue: (d: Date) => string;
  mergeIsoDateIntoDate: (base: Date, isoDate: string) => Date;
  mergeTimeIntoDate: (base: Date, timeHm: string) => Date;
  dashboard: MoonDashboard;
  moonSlide: number;
  prevMoonSlide: () => void;
  nextMoonSlide: () => void;
  lunarRef: LunarReferencePack;
  scenarioPack: ScenarioPack;
  lunarInterpret: string;
  planetRows: PlanetRow[];
  planetaryHour: PlanetaryHourInfo;
};

export function MoonCalculationsPanels(props: MoonCalculationsPanelsProps) {
  const {
    variant,
    onBack,
    backLabel,
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
  } = props;

  const datetimeRowClass = variant === 'immersive' ? 'datetime-row datetime-row--immersive' : 'datetime-row';

  return (
    <>
      {variant === 'page' && onBack && backLabel !== undefined && (
        <div className="home-moon-detail-head">
          <button type="button" className="home-moon-detail-back" onClick={onBack}>
            {backLabel}
          </button>
        </div>
      )}

            <p
              className={
                variant === 'immersive' ? 'moon-hint moon-hint--immersive' : 'moon-hint moon-hint--home'
              }
            >
              Тяните луну вверху или задайте дату и время — фаза и расчёты подстроятся.
            </p>

            <div className={datetimeRowClass}>
              <div className="datetime-text" role="group" aria-label="Дата и время выбранного момента">
                <div className="datetime-segment datetime-date-segment">
                  <span className="datetime-pick datetime-date" aria-hidden="true">
                    {dateParts.datePart}
                  </span>
                  <input
                    type="date"
                    className="datetime-native-input"
                    value={toDateInputValue(now)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setNow((prev) => mergeIsoDateIntoDate(prev, v));
                    }}
                    aria-label="Дата"
                  />
                </div>
                <span className="datetime-sep" aria-hidden="true">
                  /
                </span>
                <div className="datetime-segment datetime-time-segment">
                  <span className="datetime-pick datetime-time" aria-hidden="true">
                    {dateParts.timePart}
                  </span>
                  <input
                    type="time"
                    step={60}
                    className="datetime-native-input"
                    value={toTimeInputValue(now)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setNow((prev) => mergeTimeIntoDate(prev, v));
                    }}
                    aria-label="Время"
                  />
                </div>
              </div>
              <button type="button" className="icon-refresh" onClick={resetToNow} aria-label="Сейчас" />
            </div>

            <div className="moon-slide-deck" role="region" aria-label="Справочник по выбранному моменту">
          <div className="moon-slide-row">
            <div className="moon-slide-side moon-slide-side--lead">
              <button
                type="button"
                className="moon-slide-arrow moon-slide-arrow--prev"
                onClick={prevMoonSlide}
                aria-label={`Предыдущий блок: ${MOON_SLIDE_LABELS[(moonSlide - 1 + MOON_SLIDE_COUNT) % MOON_SLIDE_COUNT]}`}
              />
            </div>
            <div className="moon-slide-viewport">
              {moonSlide === 0 && (
                <section className="dashboard" aria-label="Тропический и сидерический">
                  <div className="dash-col dash-left">
                    <div className="dash-stack">
                      <span className="dash-mode-label">Тропический</span>
                      <div className="zodiac-mini">{dashboard.tropicalSym}</div>
                      <div className="dash-main">
                        <span className="dash-caption">Лунный день (цикл)</span>
                        <GaugeRing
                          value={(dashboard.moonPhaseDeg / 360) * 100}
                          max={100}
                          size={112}
                          label="Лунный день от новолуния"
                        >
                          <span className="gauge-num">{dashboard.lunarDay}</span>
                          <span className="gauge-zodiac">{dashboard.tropicalSym}</span>
                        </GaugeRing>
                      </div>
                      <div className="dash-bottom">
                        <div className="dotted-circle">
                          <span>{dashboard.lunarStation28}</span>
                        </div>
                        <span className="dash-foot">Стоянка (сид.)</span>
                      </div>
                    </div>
                  </div>

                  <div className="dash-col dash-right">
                    <div className="dash-stack">
                      <span className="dash-mode-label">Сидерический</span>
                      <div className="zodiac-mini">{dashboard.siderealSym}</div>
                      <div className="dash-main">
                        <span className="dash-caption">Титхи</span>
                        <GaugeRing
                          value={(dashboard.moonPhaseDeg / 360) * 100}
                          max={100}
                          size={112}
                          label="Титхи"
                        >
                          <span className="gauge-num">{dashboard.tithi}</span>
                          <span className="gauge-zodiac">{dashboard.siderealSym}</span>
                        </GaugeRing>
                      </div>
                      <div className="dash-bottom">
                        <div className="dotted-circle">
                          <span>{dashboard.nakshatra}</span>
                        </div>
                        <span className="dash-foot">Накшатра</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {moonSlide === 1 && (
                <section className="moon-calendar-panels moon-slide-panels" aria-label="Лунный прогноз">
                  <article className="moon-panel">
                    <h3 className="moon-panel-title">Лунный прогноз</h3>
                    <p className="moon-panel-lead">{lunarInterpret}</p>
                  </article>
                </section>
              )}

              {moonSlide === 2 && (
                <section className="moon-calendar-panels moon-slide-panels" aria-label="Ориентиры на день">
                  <article className="moon-panel moon-panel--scenario-guide">
                    <h3 className="moon-panel-title">Ориентиры на день</h3>
                    <div className="moon-scenario-grid">
                      <div className="moon-scenario-card">
                        <span className="moon-scenario-label">Дела</span>
                        <p>{scenarioPack.work}</p>
                      </div>
                      <div className="moon-scenario-card">
                        <span className="moon-scenario-label">Отдых</span>
                        <p>{scenarioPack.rest}</p>
                      </div>
                      <div className="moon-scenario-card">
                        <span className="moon-scenario-label">Отношения</span>
                        <p>{scenarioPack.relations}</p>
                      </div>
                      <div className="moon-scenario-card">
                        <span className="moon-scenario-label">Финансы</span>
                        <p>{scenarioPack.finance}</p>
                      </div>
                    </div>
                  </article>
                </section>
              )}

              {moonSlide === 3 && (
                <section className="moon-calendar-panels moon-slide-panels" aria-label="Редкие события">
                  <article className="moon-panel moon-panel--accent">
                    <h3 className="moon-panel-title">Редкие события</h3>
                    <ul className="moon-bullet-list">
                      {lunarRef.nextLunarEclipse && (
                        <li>
                          Ближайшее <strong>лунное затмение</strong> ({lunarRef.nextLunarEclipse.kindRu}):{' '}
                          {formatRuTime(lunarRef.nextLunarEclipse.peak)}.
                        </li>
                      )}
                      {lunarRef.nextSolarEclipse && (
                        <li>
                          Ближайшее <strong>солнечное затмение</strong> ({lunarRef.nextSolarEclipse.kindRu}):{' '}
                          {formatRuTime(lunarRef.nextSolarEclipse.peak)}.
                        </li>
                      )}
                      {lunarRef.supermoonHint && <li>{lunarRef.supermoonHint}</li>}
                      {!lunarRef.nextLunarEclipse && !lunarRef.nextSolarEclipse && !lunarRef.supermoonHint && (
                        <li>Особых событий нет — сдвиньте дату по луне.</li>
                      )}
                    </ul>
                  </article>
                </section>
              )}

              {moonSlide === 4 && (
                <section className="moon-calendar-panels moon-slide-panels" aria-label="Расширенный лунный календарь">
                  <article className="moon-panel">
                    <h3 className="moon-panel-title">Расширенный лунный календарь</h3>
                    <dl className="moon-dl">
                      <div>
                        <dt>Фазовый сектор</dt>
                        <dd>{lunarRef.phaseLabel}</dd>
                      </div>
                      <div>
                        <dt>Освещённость диска</dt>
                        <dd>{lunarRef.illuminationPct}%</dd>
                      </div>
                      <div>
                        <dt>Восход и заход Луны</dt>
                        <dd>
                          {lunarRef.moonRiseSet.rise ? formatRuTime(lunarRef.moonRiseSet.rise) : '—'} ↑ ·{' '}
                          {lunarRef.moonRiseSet.set ? formatRuTime(lunarRef.moonRiseSet.set) : '—'} ↓
                        </dd>
                      </div>
                      <div>
                        <dt>Кварталы</dt>
                        <dd>
                          {lunarRef.quarters.prev
                            ? `Было: ${lunarRef.quarters.prev.name} · ${formatRuTime(lunarRef.quarters.prev.time)}. `
                            : ''}
                          Далее:{' '}
                          {lunarRef.quarters.next
                            ? `${lunarRef.quarters.next.name} · ${formatRuTime(lunarRef.quarters.next.time)}`
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Перигей / апогей</dt>
                        <dd>
                          {lunarRef.nextPerigee
                            ? `Перигей ~${formatRuTime(lunarRef.nextPerigee.time)} (${Math.round(lunarRef.nextPerigee.distKm)} км)`
                            : '—'}
                          {' · '}
                          {lunarRef.nextApogee
                            ? `апогей ~${formatRuTime(lunarRef.nextApogee.time)} (${Math.round(lunarRef.nextApogee.distKm)} км)`
                            : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Равноденствия и солнцестояния ({now.getFullYear()})</dt>
                        <dd>
                          Мар {formatRuTime(lunarRef.seasons.mar)} · Июн {formatRuTime(lunarRef.seasons.jun)} · Сен{' '}
                          {formatRuTime(lunarRef.seasons.sep)} · Дек {formatRuTime(lunarRef.seasons.dec)}
                        </dd>
                      </div>
                      <div>
                        <dt>Смена знака Луны (ориентир)</dt>
                        <dd>
                          {lunarRef.moonSignIngressApprox
                            ? `Смена знака ≈ ${formatRuTime(lunarRef.moonSignIngressApprox)}`
                            : 'Смены знака в ближайшие сутки нет.'}
                        </dd>
                      </div>
                      <div>
                        <dt>Луна без курса</dt>
                        <dd>
                          Полный расчёт — позже. Здесь ориентир по знаку.
                        </dd>
                      </div>
                    </dl>
                  </article>
                </section>
              )}

              {moonSlide === 5 && (
                <section className="moon-calendar-panels moon-slide-panels" aria-label="Планеты и горизонт">
                  <article className="moon-panel">
                    <h3 className="moon-panel-title">Планетарный календарь</h3>
                    <p className="moon-panel-muted">
                      Геоцентрический знак по эклиптике и ретроградность (по краткому шагу 8 ч).
                    </p>
                    <div className="moon-planet-table" role="table" aria-label="Планеты">
                      <div className="moon-planet-head" role="row">
                        <span role="columnheader">Планета</span>
                        <span role="columnheader">Знак</span>
                        <span role="columnheader">Ретро</span>
                      </div>
                      {planetRows.map((row) => (
                        <div key={row.body} className="moon-planet-row" role="row">
                          <span role="cell">{row.nameRu}</span>
                          <span role="cell">{row.signRu}</span>
                          <span role="cell">{row.retro ? 'да' : 'нет'}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="moon-panel">
                    <h3 className="moon-panel-title">Планетарные часы</h3>
                    <p className="moon-panel-lead">{planetaryHour.label}</p>
                    <p className="moon-panel-strong">Управитель часа: {planetaryHour.rulerRu}</p>
                    <p className="moon-panel-muted">
                      Солнце: восход {planetaryHour.sunrise ? formatRuTime(planetaryHour.sunrise) : '—'}, закат{' '}
                      {planetaryHour.sunset ? formatRuTime(planetaryHour.sunset) : '—'}.
                    </p>
                  </article>
                </section>
              )}
            </div>

            <div className="moon-slide-side moon-slide-side--rail">
              <button
                type="button"
                className="moon-slide-arrow moon-slide-arrow--next"
                onClick={nextMoonSlide}
                aria-label={`Следующий блок: ${MOON_SLIDE_LABELS[(moonSlide + 1) % MOON_SLIDE_COUNT]}`}
              />
            </div>
          </div>
        </div>

    </>
  );
}
