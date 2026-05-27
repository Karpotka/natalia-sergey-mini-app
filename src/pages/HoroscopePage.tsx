import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ApiError, isNetworkApiError } from '../api/client';
import {
  horoscopeBuyFutureHoroscope,
  horoscopeBuyHoroscopeFull,
  horoscopeLuckyDay,
  horoscopeLuckyHistory,
  horoscopeOpen,
  type HoroscopeLuckyDayResponse,
  type HoroscopeOpenResponse,
} from '../api/mysticApi';
import {
  buildCalendarGrid,
  dateToKey,
  dayStart,
  formatDateRuLong,
  isSameDay,
  monthNavLimits,
  MONTH_NAMES,
  WEEKDAYS_SHORT,
} from '../features/horoscope/lunarCalendar';
import { moonPhaseEmojiForDate } from '../features/horoscope/moonGlyph';
import '../features/horoscope/horoscopeSurface.css';
import { tropicalSunSignIndexFromIsoDate, ZODIAC_SIGNS } from '../features/horoscope/zodiac';
import { computeMoonDashboard } from '../features/moon/astro';
import { isHoroscopeEntryAllowed, useProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import { loadLuckyDayLast, saveLuckyDayLast } from '../lib/horoscopeLocalStore';

const SIGN_CODE_TO_RU: Record<string, string> = {
  aries: 'Овен',
  taurus: 'Телец',
  gemini: 'Близнецы',
  cancer: 'Рак',
  leo: 'Лев',
  virgo: 'Дева',
  libra: 'Весы',
  scorpio: 'Скорпион',
  sagittarius: 'Стрелец',
  capricorn: 'Козерог',
  aquarius: 'Водолей',
  pisces: 'Рыбы',
};

function signCodeToRu(code: string | undefined): string | null {
  if (!code) return null;
  return SIGN_CODE_TO_RU[code.toLowerCase()] ?? null;
}

function pickNonEmptyString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}

function mapHoroscopeOpen(data: HoroscopeOpenResponse) {
  const o = data as Record<string, unknown>;
  return {
    sign_code: pickNonEmptyString(o, ['sign_code', 'signCode']),
    general_public: pickNonEmptyString(o, [
      'general_public',
      'generalPublic',
      'public_general',
      'general_free',
      'free_text',
      'text_public',
      'horoscope_public',
    ]),
    general_premium: pickNonEmptyString(o, [
      'general_premium',
      'generalPremium',
      'premium_general',
      'full_text',
      'text_premium',
      'horoscope_premium',
    ]),
  };
}

function readBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return undefined;
}

/** Цена в астрокоинах из объекта `prices` в ответе `/horoscope/open`. */
function readCrystalFromPrices(prices: unknown, ...keys: string[]): number | undefined {
  if (!prices || typeof prices !== 'object') return undefined;
  const o = prices as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v);
    if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Math.round(Number(v.trim()));
  }
  return undefined;
}

function luckyBestDayKey(data: HoroscopeLuckyDayResponse & Record<string, unknown>): string | undefined {
  const pick = (v: unknown) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined;
  return pick(data.best_day) ?? pick(data.bestDay);
}

function luckyBestTextRu(data: HoroscopeLuckyDayResponse & Record<string, unknown>): string | undefined {
  const a = data.best_text_ru;
  const b = data.bestTextRu;
  if (typeof a === 'string' && a.trim()) return a.trim();
  if (typeof b === 'string' && b.trim()) return b.trim();
  return undefined;
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const out = new Date(y, mo, d);
  if (out.getFullYear() !== y || out.getMonth() !== mo || out.getDate() !== d) return null;
  return out;
}

/** Последняя запись из `POST /horoscope/lucky/history` (формат на бэке может отличаться). */
function extractLastLuckyFromHistory(raw: unknown): { dayKey: string; text: string } | null {
  let list: unknown = raw;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) list = o.items;
    else if (Array.isArray(o.history)) list = o.history;
    else if (Array.isArray(o.records)) list = o.records;
  }
  if (!Array.isArray(list) || list.length === 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i];
    if (!row || typeof row !== 'object') continue;
    const r = row as HoroscopeLuckyDayResponse & Record<string, unknown>;
    const key = luckyBestDayKey(r);
    if (key) return { dayKey: key, text: luckyBestTextRu(r) ?? '' };
  }
  return null;
}

/** Половина окна лунного календаря вокруг «сегодня» (±30 суток). */
const RANGE_HALF = 30;

const LUCKY_RANGE_CHOICES = [7, 15, 30] as const;

export function HoroscopePage() {
  const { token, applyAstrocoinsFromResponse } = useSession();
  const { isComplete, profile } = useProfile();
  const horoscopeUnlocked = isHoroscopeEntryAllowed(profile);
  const [, setSearchParams] = useSearchParams();

  const [viewDate, setViewDate] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [openPayload, setOpenPayload] = useState<{
    sign_code?: string;
    general_public?: string;
    general_premium?: string;
  } | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openRaw, setOpenRaw] = useState<HoroscopeOpenResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<'buy_premium' | 'buy_future' | 'lucky' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<null | 'buy_premium' | 'buy_future' | 'lucky'>(null);
  const [luckyPick, setLuckyPick] = useState<{ dayKey: string; text: string } | null>(() => {
    const saved = loadLuckyDayLast();
    return saved ? { dayKey: saved.dayKey, text: saved.text } : null;
  });
  const [luckyError, setLuckyError] = useState<string | null>(null);
  const [luckyRequest, setLuckyRequest] = useState('');
  const [luckyRangeDays, setLuckyRangeDays] = useState<(typeof LUCKY_RANGE_CHOICES)[number]>(15);

  const firstAllowed = useMemo(
    () => dayStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - RANGE_HALF)),
    [today],
  );
  const lastAllowed = useMemo(
    () => dayStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() + RANGE_HALF)),
    [today],
  );

  const { canGoPrev, canGoNext } = useMemo(() => monthNavLimits(today, viewDate, RANGE_HALF), [today, viewDate]);

  const grid = useMemo(() => buildCalendarGrid(viewDate, today, RANGE_HALF), [viewDate, today]);

  const prevMonth = useCallback(() => {
    if (!canGoPrev) return;
    setViewDate((d) => {
      const n = new Date(d);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  }, [canGoPrev]);

  const nextMonth = useCallback(() => {
    if (!canGoNext) return;
    setViewDate((d) => {
      const n = new Date(d);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  }, [canGoNext]);

  const goPrevDay = useCallback(() => {
    setSelectedDate((prev) => {
      const p = new Date(prev);
      p.setDate(p.getDate() - 1);
      if (dayStart(p) < firstAllowed) return prev;
      return p;
    });
  }, [firstAllowed]);

  const goNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const p = new Date(prev);
      p.setDate(p.getDate() + 1);
      if (dayStart(p) > lastAllowed) return prev;
      return p;
    });
  }, [lastAllowed]);

  const canGoPrevDay = dayStart(selectedDate) > firstAllowed;
  const canGoNextDay = dayStart(selectedDate) < lastAllowed;

  const selectedIsToday = isSameDay(selectedDate, today);

  useEffect(() => {
    if (!profile.birthDate?.trim()) {
      setOpenPayload(null);
      setOpenError('Укажите дату рождения в профиле.');
      setOpenLoading(false);
      return;
    }

    setOpenError(null);
    if (!token) {
      setOpenPayload(null);
      setOpenRaw(null);
      setOpenLoading(false);
      setOpenError(null);
      return;
    }

    let cancelled = false;
    setOpenLoading(true);
    horoscopeOpen(dateToKey(selectedDate), token)
      .then((data) => {
        if (cancelled) return;
        if (data.has_profile === false) {
          setOpenPayload(null);
          setOpenRaw(data);
          setOpenError('Сохраните дату рождения в кабинете.');
          return;
        }
        setOpenRaw(data);
        setOpenPayload(mapHoroscopeOpen(data));
      })
      .catch((e) => {
        if (cancelled) return;
        setOpenPayload(null);
        setOpenRaw(null);
        setOpenError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      })
      .finally(() => {
        if (!cancelled) setOpenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, profile.birthDate, token]);

  useEffect(() => {
    if (!token || !profile.birthDate?.trim()) return;
    let cancelled = false;
    horoscopeLuckyHistory(token)
      .then((raw) => {
        if (cancelled) return;
        const last = extractLastLuckyFromHistory(raw);
        if (last) setLuckyPick((prev) => (prev ? prev : last));
      })
      .catch(() => {
        /* история опциональна */
      });
    return () => {
      cancelled = true;
    };
  }, [token, profile.birthDate]);

  const dayKey = dateToKey(selectedDate);

  const onBuyPremium = useCallback(async () => {
    if (!token) return;
    setActionLoading('buy_premium');
    setActionMessage(null);
    try {
      const data = await horoscopeBuyHoroscopeFull({ day: dayKey }, token);
      applyAstrocoinsFromResponse(data);
      const prem = (data as Record<string, unknown>).general_premium;
      if (typeof prem === 'string' && prem.trim()) {
        setOpenPayload((prev) => ({ ...prev, general_premium: prem }));
      }
      setActionMessage('Премиум-часть открыта.');
    } catch (e) {
      setActionMessage(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setActionLoading(null);
    }
  }, [dayKey, token, applyAstrocoinsFromResponse]);

  const onBuyFuture = useCallback(async () => {
    if (!token) return;
    setActionLoading('buy_future');
    setActionMessage(null);
    try {
      const data = (await horoscopeBuyFutureHoroscope({ day: dayKey }, token)) as HoroscopeOpenResponse;
      applyAstrocoinsFromResponse(data);
      setOpenRaw(data);
      setOpenPayload(mapHoroscopeOpen(data));
      setActionMessage('Гороскоп на будущий день открыт.');
    } catch (e) {
      setActionMessage(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setActionLoading(null);
    }
  }, [dayKey, token, applyAstrocoinsFromResponse]);

  const onLuckyDay = useCallback(async () => {
    if (!token) return;
    const req = luckyRequest.trim();
    if (!req) {
      setLuckyError('Опишите цель подбора.');
      return;
    }

    setActionLoading('lucky');
    setLuckyError(null);
    const base = [profile.name.trim(), profile.birthDate?.trim()].filter(Boolean).join(' · ');
    const query = base ? `${base}. Запрос: ${req}` : `Запрос: ${req}`;

    const applyLuckyPayload = (data: HoroscopeLuckyDayResponse & Record<string, unknown>) => {
      const err = typeof data.error === 'string' ? data.error.trim() : '';
      if (err) {
        setLuckyPick(null);
        setLuckyError(err);
        return;
      }
      applyAstrocoinsFromResponse(data);
      const bestKey = luckyBestDayKey(data);
      const text = luckyBestTextRu(data);
      if (bestKey) {
        const pick = { dayKey: bestKey, text: text ?? '' };
        setLuckyPick(pick);
        saveLuckyDayLast({ dayKey: pick.dayKey, text: pick.text, query: query.trim() || undefined });
        const d = parseYmdLocal(bestKey);
        if (d) {
          const t = dayStart(d);
          if (t >= firstAllowed && t <= lastAllowed) {
            setSelectedDate(d);
            setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
          }
        }
      } else {
        setLuckyPick(null);
        setLuckyError('Сервис не вернул дату. Попробуйте позже или напишите в поддержку.');
      }
    };

    const body = { query, range_days: luckyRangeDays, pay: 'crystal' } as const;

    try {
      const data = (await horoscopeLuckyDay(body, token)) as HoroscopeLuckyDayResponse & Record<string, unknown>;
      applyLuckyPayload(data);
    } catch (e) {
      if (isNetworkApiError(e)) {
        try {
          const data = (await horoscopeLuckyDay(body, token)) as HoroscopeLuckyDayResponse & Record<string, unknown>;
          applyLuckyPayload(data);
        } catch (e2) {
          setLuckyError(
            e2 instanceof ApiError ? `${e2.code}: ${e2.message}` : 'Повторный запрос тоже не удался. Попробуйте позже.',
          );
        }
      } else {
        setLuckyError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      }
    } finally {
      setActionLoading(null);
    }
  }, [
    profile.name,
    profile.birthDate,
    token,
    firstAllowed,
    lastAllowed,
    applyAstrocoinsFromResponse,
    luckyRequest,
    luckyRangeDays,
  ]);

  const openCabinet = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('panel', 'profile');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const displayZodiac =
    selectedIsToday && openPayload?.sign_code
      ? signCodeToRu(openPayload.sign_code)
      : profile.birthDate
        ? ZODIAC_SIGNS[tropicalSunSignIndexFromIsoDate(profile.birthDate)].name
        : null;

  const luckyCalendarKey = luckyPick?.dayKey ?? null;
  const luckyPickLabel = useMemo(() => {
    if (!luckyPick?.dayKey) return '';
    const d = parseYmdLocal(luckyPick.dayKey);
    return d ? formatDateRuLong(d) : luckyPick.dayKey;
  }, [luckyPick]);

  const raw = openRaw as Record<string, unknown> | null;
  const hasPublic = Boolean(openPayload?.general_public?.trim());
  const hasPremium = Boolean(openPayload?.general_premium?.trim());
  const needBuyPremium = Boolean(
    openRaw && (readBool(raw?.need_buy_premium) || readBool(raw?.needBuyPremium)),
  );
  const needBuyDay = Boolean(openRaw && (readBool(raw?.need_buy_day) || readBool(raw?.needBuyDay)));
  const showPremiumUpsell = Boolean(token && openRaw && !openError && needBuyPremium && !hasPremium);
  const horoscopePrices = useMemo(() => {
    const r = openRaw as Record<string, unknown> | null;
    const p = r?.prices;
    return {
      premHoroscope: readCrystalFromPrices(p, 'prem_horoscope_crystal', 'premHoroscopeCrystal'),
      dayOpen: readCrystalFromPrices(p, 'day_open_crystal', 'dayOpenCrystal'),
      luckyDay: readCrystalFromPrices(p, 'lucky_day_crystal', 'luckyDayCrystal'),
    };
  }, [openRaw]);

  const handlePurchaseConfirm = () => {
    const k = confirmKind;
    setConfirmKind(null);
    if (!k) return;
    if (k === 'buy_premium') void onBuyPremium();
    else if (k === 'buy_future') void onBuyFuture();
    else if (k === 'lucky') void onLuckyDay();
  };

  const renderConfirmModal = () => {
    if (!confirmKind || typeof document === 'undefined') return null;
    let title = '';
    let body = '';
    let crystal: number | undefined;
    if (confirmKind === 'buy_future') {
      title = 'Открыть этот день?';
      body = 'День готов, но закрыт подпиской. После оплаты откроется здесь.';
      crystal = horoscopePrices.dayOpen;
    } else if (confirmKind === 'buy_premium') {
      title = 'Купить полную версию?';
      body = 'Полная версия за астрокоины — текст появится ниже.';
      crystal = horoscopePrices.premHoroscope;
    } else {
      title = 'Подобрать удачный день?';
      body = `Подбор в ближайшие ${luckyRangeDays} дней. Результат — после оплаты.`;
      crystal = horoscopePrices.luckyDay;
    }
    return createPortal(
      <div className="horoscope-confirm-backdrop" onClick={() => setConfirmKind(null)} role="presentation">
        <div
          className="horoscope-confirm-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="horoscope-confirm-title"
        >
          <h3 id="horoscope-confirm-title">{title}</h3>
          <p>{body}</p>
          {typeof crystal === 'number' ? (
            <p className="horoscope-confirm-price">К оплате: ✦ {crystal}</p>
          ) : (
            <p className="horoscope-confirm-price" style={{ fontSize: 14, fontWeight: 500, opacity: 0.82 }}>
              Цена уточнится при подтверждении.
            </p>
          )}
          <div className="horoscope-confirm-actions">
            <button type="button" className="btn-primary horoscope-confirm-primary" onClick={handlePurchaseConfirm}>
              Подтвердить
            </button>
            <button type="button" className="btn-ghost horoscope-confirm-cancel" onClick={() => setConfirmKind(null)}>
              Отмена
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  if (!horoscopeUnlocked) {
  return (
    <div className="product-page">
        <section className="product-hero product-hero--horoscope horoscope-gate">
          <h1>Астрология</h1>
          <p>
            Укажите в кабинете <strong>имя</strong> и <strong>дату рождения</strong> — откроется календарь и бесплатный
            фрагмент.
          </p>
          <div className="horoscope-gate-actions">
            <button type="button" className="btn-primary" onClick={openCabinet}>
              В кабинет
            </button>
          </div>
          <p className="horoscope-gate-hint">Сохраните и вернитесь сюда через меню.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="product-page horoscope-page">
      <section className="product-hero product-hero--horoscope">
        <h1>Астрология</h1>
        <p className="horoscope-profile-ref">
          Профиль: <strong>{profile.name.trim()}</strong>
          {profile.birthDate ? (
            <>
              {' '}
              · {profile.birthDate}
              {profile.birthTime ? ` · ${profile.birthTime}` : ''}
              {profile.birthPlace ? ` · ${profile.birthPlace}` : ''}
            </>
          ) : null}
          .{' '}
          <button type="button" className="horoscope-profile-link" onClick={openCabinet}>
            Изменить в кабинете
          </button>
        </p>

        {!isComplete && (
          <p className="horoscope-profile-incomplete" role="status">
            Для точности добавьте в кабинете пол, время и место рождения.
          </p>
        )}

        <div className="horoscope-cal-panel">
          <div className="horoscope-month-nav">
            <button type="button" onClick={prevMonth} disabled={!canGoPrev} aria-label="Предыдущий месяц">
              ‹
            </button>
            <span className="horoscope-month-label">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button type="button" onClick={nextMonth} disabled={!canGoNext} aria-label="Следующий месяц">
              ›
            </button>
          </div>
          <div className="horoscope-weekdays" aria-hidden="true">
            {WEEKDAYS_SHORT.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>
          <div className="horoscope-grid">
            {grid.map(({ date, inMonth, disabled }, idx) => {
              const selected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const isLucky = Boolean(luckyCalendarKey && dateToKey(date) === luckyCalendarKey);
              return (
                <button
                  key={`${idx}-${dateToKey(date)}-${inMonth ? 'm' : 'o'}`}
                  type="button"
                  disabled={disabled}
                  aria-label={
                    isLucky
                      ? `${date.getDate()}, отмечен как удачный день`
                      : undefined
                  }
                  className={
                    'horoscope-cell' +
                    (!inMonth ? ' other-month' : '') +
                    (isToday ? ' is-today' : '') +
                    (selected ? ' is-selected' : '') +
                    (isLucky ? ' is-lucky' : '')
                  }
                  onClick={() => {
                    if (!disabled) setSelectedDate(new Date(date));
                  }}
                >
                  {isLucky ? (
                    <span className="horoscope-cell-lucky-mark" aria-hidden>
                      ✦
                    </span>
                  ) : null}
                  <span className="horoscope-cell-moon" aria-hidden>
                    {moonPhaseEmojiForDate(date)}
                  </span>
                  <span className="horoscope-cell-day">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="horoscope-day-footer" aria-label="Пояснение по выбранному дню">
          <p className="horoscope-day-hint horoscope-day-footer-meta">
            <strong>{formatDateRuLong(selectedDate)}</strong>
            {' · '}
            знак по дате рождения: <strong>{displayZodiac ?? '—'}</strong>
          </p>

          <div className="horoscope-day-nav">
            <button type="button" onClick={goPrevDay} disabled={!canGoPrevDay} aria-label="Предыдущий день">
              ‹
            </button>
            <div className="horoscope-day-title">
              <strong>{formatDateRuLong(selectedDate)}</strong>
              <span>
                {moonPhaseEmojiForDate(selectedDate)} лунный день {computeMoonDashboard(selectedDate).lunarDay}
              </span>
            </div>
            <button type="button" onClick={goNextDay} disabled={!canGoNextDay} aria-label="Следующий день">
              ›
            </button>
          </div>

          {!profile.birthDate?.trim() && <p className="horoscope-day-error">Укажите дату рождения в профиле.</p>}

          {profile.birthDate?.trim() && (
            <div className="horoscope-day-detail">
              <div className="horoscope-day-block">
                <h3 className="horoscope-day-block-title">Гороскоп на день</h3>

                {openLoading && <p className="horoscope-day-block-text">Загружаем гороскоп…</p>}

                {!openLoading && !token && (
                  <p className="horoscope-day-hint">
                    Войдите, чтобы открыть гороскоп.
                  </p>
                )}

                {!openLoading && token && openError && <p className="horoscope-day-error">{openError}</p>}

                {!openLoading &&
                  token &&
                  openPayload &&
                  (hasPublic || hasPremium) && (
                    <>
                      {hasPublic && (
                        <div className="horoscope-tier">
                          <span className="horoscope-tier-badge horoscope-tier-badge--free">Бесплатно</span>
                          <p className="horoscope-day-block-text">{openPayload.general_public}</p>
                        </div>
                      )}
                      {hasPremium && (
                        <div className="horoscope-tier">
                          <span className="horoscope-tier-badge horoscope-tier-badge--full">Полная версия</span>
                          <p className="horoscope-day-block-text">{openPayload.general_premium}</p>
                        </div>
                      )}
                    </>
                  )}

                {showPremiumUpsell && (
                  <div className="horoscope-premium-upsell">
                    <div className="horoscope-premium-upsell-head">
                      <span className="horoscope-tier-badge horoscope-tier-badge--premium">Премиум</span>
                      <p className="horoscope-premium-upsell-title">Платное продолжение</p>
                    </div>
                    <p className="horoscope-premium-upsell-text">
                      Полная версия за астрокоины — отдельно от бесплатной.
                    </p>
                  </div>
                )}

                {!openLoading &&
                  token &&
                  openRaw &&
                  !openError &&
                  !hasPublic &&
                  !hasPremium && (
                    <div>
                      {needBuyDay ? (
                        <p className="horoscope-day-hint">
                          День готов, но закрыт. Откройте за астрокоины — кнопка ниже.
                        </p>
                      ) : needBuyPremium ? (
                        <div className="horoscope-premium-upsell horoscope-premium-upsell--solo">
                          <div className="horoscope-premium-upsell-head">
                            <span className="horoscope-tier-badge horoscope-tier-badge--premium">Премиум</span>
                            <p className="horoscope-premium-upsell-title">Платный гороскоп на этот день</p>
                          </div>
                          <p className="horoscope-premium-upsell-text">
                            Бесплатного текста нет — полная версия за астрокоины.
                          </p>
                        </div>
                      ) : (
                        <p className="horoscope-day-hint">
                          Текста пока нет. Выберите другой день (±30 суток).
                        </p>
                      )}
                    </div>
                  )}

                {!openLoading && token && (
                  <div className="consult-form-actions horoscope-day-pay-actions">
                    {openRaw && needBuyPremium && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={actionLoading !== null}
                        onClick={() => setConfirmKind('buy_premium')}
                      >
                        {actionLoading === 'buy_premium'
                          ? 'Открываем…'
                          : typeof horoscopePrices.premHoroscope === 'number'
                            ? `Купить полную версию — ✦ ${horoscopePrices.premHoroscope}`
                            : 'Купить полную версию'}
                      </button>
                    )}
                    {openRaw && needBuyDay && (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={actionLoading !== null}
                        onClick={() => setConfirmKind('buy_future')}
                      >
                        {actionLoading === 'buy_future'
                          ? 'Открываем…'
                          : typeof horoscopePrices.dayOpen === 'number'
                            ? `Открыть этот день — ✦ ${horoscopePrices.dayOpen}`
                            : 'Открыть этот день'}
                      </button>
                    )}
                  </div>
                )}
                {actionMessage && <p className="horoscope-day-hint" style={{ marginTop: 8 }}>{actionMessage}</p>}
              </div>

              <div className="horoscope-day-block horoscope-day-block-lucky">
                <h3 className="horoscope-day-block-title">Удачный день</h3>
                <p className="horoscope-day-hint">
                  Опишите цель: свадьба, поездка, разговор… Поиск в ближайшие <strong>7, 15 или 30</strong> дней.
                  {typeof horoscopePrices.luckyDay === 'number' ? (
                    <>
                      {' '}
                      Подбор: <strong>✦ {horoscopePrices.luckyDay}</strong> (после подтверждения).
                    </>
                  ) : (
                    <> Оплата астрокоинами.</>
                  )}{' '}
                  ★ в сетке — прошлый подбор.
                </p>
                {!token && (
                  <p className="horoscope-day-hint">Войдите для подбора дня.</p>
                )}
                {token && (
                  <>
                    <label className="horoscope-lucky-field">
                      <span className="horoscope-lucky-label">Ваш запрос</span>
                      <textarea
                        className="horoscope-lucky-textarea"
                        value={luckyRequest}
                        onChange={(e) => setLuckyRequest(e.target.value)}
                        rows={3}
                        maxLength={800}
                        placeholder="Например: когда лучше подписать договор по новой работе"
                        autoComplete="off"
                      />
                    </label>
                    <div className="horoscope-lucky-range" role="group" aria-label="Горизонт поиска, дней">
                      <span className="horoscope-lucky-range-caption">Искать в ближайшие</span>
                      {LUCKY_RANGE_CHOICES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={'horoscope-lucky-range-btn' + (luckyRangeDays === n ? ' is-active' : '')}
                          onClick={() => setLuckyRangeDays(n)}
                          aria-pressed={luckyRangeDays === n}
                        >
                          {n} дн.
                        </button>
                      ))}
                    </div>
                    <div className="consult-form-actions" style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={actionLoading !== null || !luckyRequest.trim()}
                        onClick={() => {
                          if (!luckyRequest.trim()) {
                            setLuckyError('Опишите цель подбора.');
                            return;
                          }
                          setLuckyError(null);
                          setConfirmKind('lucky');
                        }}
                      >
                        {actionLoading === 'lucky'
                          ? 'Подбираем…'
                          : typeof horoscopePrices.luckyDay === 'number'
                            ? `Подобрать удачный день — ✦ ${horoscopePrices.luckyDay}`
                            : 'Подобрать удачный день'}
                      </button>
                    </div>
                    {luckyError && (
                      <p className="horoscope-day-error" style={{ marginTop: 10 }}>
                        {luckyError}
                      </p>
                    )}
                    {luckyPick && (
                      <div className="horoscope-lucky-result" style={{ marginTop: 12 }}>
                        <p className="horoscope-day-block-text" style={{ marginBottom: luckyPick.text ? 8 : 0 }}>
                          <span className="horoscope-lucky-badge" aria-hidden>
                            ★
                          </span>{' '}
                          <strong>{luckyPickLabel}</strong>
                          {luckyPick.dayKey ? ` · ${luckyPick.dayKey}` : null}
                        </p>
                        {luckyPick.text ? (
                          <p className="horoscope-day-block-text">{luckyPick.text}</p>
                        ) : (
                          <p className="horoscope-day-hint">
                            Пояснения нет — повторите запрос позже.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      {renderConfirmModal()}
    </div>
  );
}
