import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { isBackendEnabled } from '../api/config';
import {
  profileAddParam,
  profileChangeParam,
  profileGet,
  subscribeBuy,
  type ProfileAddParamBody,
  type ProfileSex,
} from '../api/mysticApi';
import { isProfileComplete, useProfile, type UserGender, type UserProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import { profileFromApi } from '../lib/profileFromApi';
import { clearPaymentFlowState, readPaymentFlowState } from '../lib/paymentFlowSession';
import { formatPaymentOrOrderErrorForUser } from '../lib/paymentUserErrors';
import { fetchPlaceSuggestions, type PlaceSuggestion } from '../lib/placeSearch';
import { AstrocoinTopupSection } from '../features/profile/AstrocoinTopupSection';
import { TarotBackEquipStrip } from '../features/tarot/TarotBackEquipStrip';
import { TarotBackShopSection } from '../features/tarot/TarotBackShopSection';
import { readProductPanel } from '../layout/ProductPager';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
];

const SUBSCRIPTION_PLANS = [
  { id: 'week' as const, title: 'Еженедельно', price: 699, hint: '7 дней доступа' },
  { id: 'month' as const, title: 'Ежемесячно', price: 1299, hint: '30 дней доступа' },
  { id: 'year' as const, title: 'Ежегодно', price: 2999, hint: '12 месяцев доступа', featured: true },
];

/** Цена подписки в астрокоинах (курс отображения: 1 ✦ = 1 ₽). */
function formatAstrocoins(n: number) {
  return '✦ ' + new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ');
}

function subscriptionProductId(planId: (typeof SUBSCRIPTION_PLANS)[number]['id']): number | null {
  const byPlan =
    planId === 'week'
      ? import.meta.env.VITE_SUBSCRIPTION_PRODUCT_ID_WEEK
      : planId === 'month'
        ? import.meta.env.VITE_SUBSCRIPTION_PRODUCT_ID_MONTH
        : import.meta.env.VITE_SUBSCRIPTION_PRODUCT_ID_YEAR;
  const s = String(byPlan ?? '').trim();
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeSex(gender: UserGender | ''): ProfileSex | null {
  if (gender === 'female' || gender === 'male') return gender;
  return null;
}

/** Бэкенд ожидает время как `HH:MM`, не `HH:MM:SS`. */
function birthTimeToApi(birthTime: string, hasExact: boolean): string | null {
  if (!hasExact) return null;
  const t = birthTime.trim();
  if (!t) return null;
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  return t;
}

function timeToHhMm(s: string): string {
  const t = s.trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  return t;
}

function timesEqual(a: string, b: string): boolean {
  return timeToHhMm(a) === timeToHhMm(b);
}

/** Частичное тело `POST /profile/changeParam` — только отличия от последнего сохранённого профиля. */
function buildProfileChangePatch(
  local: UserProfile,
  baseline: UserProfile,
  sex: ProfileSex,
  tzName: string,
  selectedPlace: PlaceSuggestion | null,
): Partial<ProfileAddParamBody> {
  const patch: Partial<ProfileAddParamBody> = {};
  if (local.name.trim() !== baseline.name.trim()) patch.name = local.name.trim();

  const localHasExact = !local.birthTimeUnknown && Boolean(local.birthTime?.trim());
  const baseHasExact = !baseline.birthTimeUnknown && Boolean(baseline.birthTime?.trim());
  const birthDirty =
    local.birthDate !== baseline.birthDate ||
    Boolean(local.birthTimeUnknown) !== Boolean(baseline.birthTimeUnknown) ||
    localHasExact !== baseHasExact ||
    (localHasExact && baseHasExact && !timesEqual(local.birthTime, baseline.birthTime));
  if (birthDirty) {
    const hasExact = localHasExact;
    patch.birth_date = local.birthDate;
    patch.has_exact_time = hasExact;
    patch.birth_time_str = birthTimeToApi(local.birthTime, hasExact);
  }

  const baseSex = normalizeSex(baseline.gender);
  if (sex !== baseSex) patch.sex = sex;

  if (local.birthPlace.trim() !== baseline.birthPlace.trim()) {
    patch.place_name = local.birthPlace.trim();
    patch.tz_name = tzName;
  }

  if (selectedPlace) {
    patch.lat = selectedPlace.lat;
    patch.lon = selectedPlace.lon;
    patch.tz_name = tzName;
  }

  return patch;
}

export function ProfilePage() {
  const { profile, setProfile } = useProfile();
  const [searchParams] = useSearchParams();
  const panel = readProductPanel(searchParams);
  const { token, astrocoins, authMode, platform, applyAstrocoinsFromResponse, refreshAstrocoinsFromProfile } =
    useSession();
  const backendOn = isBackendEnabled();
  const [local, setLocal] = useState<UserProfile>(() => ({ ...profile }));
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasServerProfile, setHasServerProfile] = useState(false);
  const [subNotice, setSubNotice] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<(typeof SUBSCRIPTION_PLANS)[number]['id'] | null>(null);
  const [subPayLoading, setSubPayLoading] = useState(false);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [pendingSubscriptionPayment, setPendingSubscriptionPayment] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const placeBlurTimer = useRef<number | null>(null);

  useEffect(() => {
    setLocal({ ...profile });
  }, [profile]);

  useEffect(() => {
    if (panel !== 'profile' || !backendOn || !token) return;
    void refreshAstrocoinsFromProfile();
  }, [panel, backendOn, token, refreshAstrocoinsFromProfile]);

  useEffect(() => {
    if (!backendOn || !token || initialLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await profileGet(token);
        applyAstrocoinsFromResponse(data);
        if (cancelled) return;
        const mapped = profileFromApi(data);
        const hasBirthOnServer = Boolean(data.birth_date && String(data.birth_date).trim());
        setHasServerProfile(hasBirthOnServer);
        setSubscriptionEndsAt(typeof data.date === 'string' ? data.date : null);
        const hasAnyServerField = Boolean(
          mapped.name.trim() ||
            mapped.birthDate ||
            mapped.birthTime ||
            mapped.birthPlace.trim() ||
            mapped.gender,
        );
        if (hasAnyServerField) {
          setProfile(mapped);
          setLocal(mapped);
        }
      } catch {
        /* ignore: оставляем локальный профиль */
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendOn, token, initialLoaded, setProfile, applyAstrocoinsFromResponse]);

  useEffect(() => {
    const flow = readPaymentFlowState();
    setPendingSubscriptionPayment(flow?.kind === 'subscription');
  }, []);

  useEffect(() => {
    const q = local.birthPlace.trim();
    if (q.length < 2) {
      setPlaceSuggestions([]);
      setPlaceLoading(false);
      return;
    }
    let cancelled = false;
    setPlaceLoading(true);
    const id = window.setTimeout(() => {
      fetchPlaceSuggestions(q, { language: 'ru' }).then((rows) => {
        if (!cancelled) {
          setPlaceSuggestions(rows);
          setPlaceLoading(false);
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      setPlaceLoading(false);
    };
  }, [local.birthPlace]);

  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(profile), [local, profile]);

  const applyFromStorage = () => {
    setLocal({ ...profile });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const submit = async () => {
      if (!backendOn || !token) {
        setProfile({ ...local });
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2000);
        return;
      }

      const sex = normalizeSex(local.gender);
      if (!sex) {
        setSaveError('Выберите пол.');
        return;
      }

      const hasExact = !local.birthTimeUnknown && Boolean(local.birthTime?.trim());
      if (!local.birthTimeUnknown && !local.birthTime.trim()) {
        setSaveError('Укажите время рождения или отметьте «Не знаю точного времени».');
        return;
      }

      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
      const fullPayload: ProfileAddParamBody = {
        name: local.name.trim(),
        sex,
        birth_date: local.birthDate,
        birth_time_str: birthTimeToApi(local.birthTime, hasExact),
        has_exact_time: hasExact,
        place_name: local.birthPlace.trim(),
        tz_name: tzName,
      };
      if (selectedPlace) {
        fullPayload.lat = selectedPlace.lat;
        fullPayload.lon = selectedPlace.lon;
      }

      setSaving(true);
      try {
        if (hasServerProfile) {
          const patch = buildProfileChangePatch(local, profile, sex, tzName, selectedPlace);
          if (Object.keys(patch).length === 0) {
            setProfile({ ...local });
            setSavedFlash(true);
            window.setTimeout(() => setSavedFlash(false), 2000);
            return;
          }
          await profileChangeParam(patch, token);
        } else {
          try {
            await profileAddParam(fullPayload, token);
          } catch (e) {
            // На части окружений first-save принимает только changeParam.
            if (e instanceof ApiError && (e.status === 404 || e.status >= 500)) {
              await profileChangeParam(fullPayload, token);
            } else {
              throw e;
            }
          }
        }

        // Каноничная проверка: профиль рождения действительно появился на бэке.
        const check = await profileGet(token);
        applyAstrocoinsFromResponse(check);
        const checkMapped = profileFromApi(check);
        const hasBirthOnServer = Boolean(check.birth_date && String(check.birth_date).trim());
        if (!hasBirthOnServer) {
          // Если changeParam прошёл «мимо» (или сервер не создал birth_profile), форсим addParam.
          await profileAddParam(fullPayload, token);
          const check2 = await profileGet(token);
          applyAstrocoinsFromResponse(check2);
          const mapped2 = profileFromApi(check2);
          const hasBirth2 = Boolean(check2.birth_date && String(check2.birth_date).trim());
          if (!hasBirth2) {
            throw new ApiError('Сервер не сохранил birth_profile. Проверьте обязательные поля в API.', {
              code: 'profile_not_persisted',
              status: 500,
            });
          }
          setHasServerProfile(true);
          setProfile(mapped2);
          setLocal(mapped2);
        } else {
          setHasServerProfile(true);
          setProfile(checkMapped);
          setLocal(checkMapped);
        }
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2000);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? `HTTP ${err.status}: ${err.message}`
            : 'Не удалось сохранить профиль на сервере.';
        setSaveError(msg);
      } finally {
        setSaving(false);
      }
    };
    void submit();
  };

  const onSubscribeIntent = (planId: (typeof SUBSCRIPTION_PLANS)[number]['id']) => {
    setSelectedPlanId(planId);
    setSubNotice(null);
  };

  const paySelectedSubscription = async () => {
    setSubNotice(null);
    if (!token) {
      setSubNotice('Для оплаты подписки войдите через VK.');
      return;
    }
    if (!selectedPlanId) {
      setSubNotice('Сначала выберите тариф.');
      return;
    }
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId);
    if (!plan) {
      setSubNotice('Не удалось определить выбранный тариф.');
      return;
    }
    const productId = subscriptionProductId(selectedPlanId);
    if (!productId) {
      setSubNotice('Тариф временно недоступен. Попробуйте позже.');
      return;
    }

    if (astrocoins !== null && astrocoins < plan.price) {
      setSubNotice(
        `Недостаточно астрокоинов: нужно ${formatAstrocoins(plan.price)}, на счёте ✦ ${new Intl.NumberFormat('ru-RU').format(astrocoins).replace(/\u00a0/g, ' ')}.`,
      );
      return;
    }

    setSubPayLoading(true);
    try {
      const raw = await subscribeBuy({ id: productId }, token);
      const status = typeof raw.status === 'string' ? raw.status : '';
      if (status === 'not_enough_crystals' || status === 'not_enough_points') {
        setSubNotice('Недостаточно астрокоинов на счёте.');
        return;
      }
      if (status === 'invalid_price') {
        setSubNotice('Тариф недоступен или изменился. Обновите страницу и попробуйте снова.');
        return;
      }
      if (status === 'error') {
        const msg = typeof raw.message === 'string' ? raw.message : 'Ошибка оплаты подпиской.';
        setSubNotice(msg);
        return;
      }

      applyAstrocoinsFromResponse(raw);
      if (raw.result && typeof raw.result === 'object') applyAstrocoinsFromResponse(raw.result);

      const data = await profileGet(token);
      applyAstrocoinsFromResponse(data);
      setSubscriptionEndsAt(typeof data.date === 'string' ? data.date : null);
      clearPaymentFlowState();
      setPendingSubscriptionPayment(false);
      setSubNotice('Подписка оплачена астрокоинами. Спасибо!');
    } catch (e) {
      setSubNotice(formatPaymentOrOrderErrorForUser(e));
    } finally {
      setSubPayLoading(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    if (!token) return;
    setCheckingPaymentStatus(true);
    try {
      const prev = subscriptionEndsAt;
      const data = await profileGet(token);
      applyAstrocoinsFromResponse(data);
      const nextEndsAt = typeof data.date === 'string' ? data.date : null;
      setSubscriptionEndsAt(nextEndsAt);
      const becameActive = Boolean(nextEndsAt && nextEndsAt !== prev);
      if (becameActive) {
        clearPaymentFlowState();
        setPendingSubscriptionPayment(false);
        setSubNotice('Оплата подтверждена. Подписка активирована.');
      } else {
        setSubNotice('Платёж ещё в обработке. Нажмите «Проверить оплату» чуть позже.');
      }
    } catch (e) {
      setSubNotice(formatPaymentOrOrderErrorForUser(e));
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  useEffect(() => {
    if (!pendingSubscriptionPayment || !token) return;
    let stopped = false;
    let tries = 0;
    const maxTries = 6;
    const tick = async () => {
      if (stopped) return;
      tries += 1;
      await refreshSubscriptionStatus();
      if (stopped) return;
      if (tries < maxTries && pendingSubscriptionPayment) {
        window.setTimeout(tick, 3500);
      }
    };
    window.setTimeout(tick, 1200);
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubscriptionPayment, token]);

  return (
    <div className="product-page profile-page">
      <section className="product-hero product-hero--profile">
        <h1>Личный кабинет</h1>
        <p>Профиль для персональных расчётов. Данные на устройстве.</p>
      </section>

      <section className="profile-astrocoins" aria-labelledby="profile-astrocoins-heading">
        <h2 id="profile-astrocoins-heading" className="profile-astrocoins-title">
          Астрокоины
        </h2>
        <p className="profile-astrocoins-lead">
          Астрокоины — подписка, удачный день, Таро. Консультации — отдельно, в ₽.
        </p>
        {token && astrocoins !== null ? (
          <p className="profile-astrocoins-balance" role="status" aria-label={`Астрокоинов на счёте: ${astrocoins}`}>
            <span className="profile-astrocoins-value">✦ {astrocoins}</span>
            <span className="profile-astrocoins-label">доступно сейчас</span>
          </p>
        ) : token && authMode === 'dev_token' ? (
          <p className="profile-astrocoins-lead" style={{ marginBottom: 0 }}>
            Баланс обновится после первой оплаты астрокоинами.
          </p>
        ) : token ? (
          <p className="profile-astrocoins-lead" style={{ marginBottom: 0 }}>
            {platform === 'telegram'
              ? 'Баланс подтянется после входа через Telegram.'
              : 'Зайдите в приложение через VK — мы автоматически покажем ваш баланс астрокоинов.'}
          </p>
        ) : (
          <p className="profile-astrocoins-lead" style={{ marginBottom: 0 }}>
            {platform === 'telegram'
              ? 'Войдите через Telegram, чтобы увидеть счёт астрокоинов.'
              : 'Войдите через VK, чтобы увидеть свой счёт астрокоинов.'}
          </p>
        )}
      </section>

      {backendOn ? <AstrocoinTopupSection /> : null}

      {backendOn && platform === 'telegram' ? <TarotBackEquipStrip /> : null}
      {backendOn && platform !== 'telegram' ? <TarotBackShopSection /> : null}

      <section className="profile-subscription" aria-labelledby="profile-subscription-heading">
        <h2 id="profile-subscription-heading" className="profile-subscription-title">
          Подписка
        </h2>
        <p className="profile-subscription-lead">
          Подписка: гороскопы и материалы. Оплата <strong>астрокоинами</strong> (<strong>1 ✦ ≈ 1 ₽</strong>).
        </p>
        <div className="profile-plan-grid">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={'profile-plan-card' + (plan.featured ? ' profile-plan-card--featured' : '')}
            >
              <div className="profile-plan-head">
                {plan.featured && <span className="profile-plan-badge">Выгодно</span>}
                <h3 className="profile-plan-name">{plan.title}</h3>
              </div>
              <p className="profile-plan-price">{formatAstrocoins(plan.price)}</p>
              <p className="profile-plan-hint">{plan.hint}</p>
              <button
                type="button"
                className="profile-plan-btn btn-primary"
                onClick={() => onSubscribeIntent(plan.id)}
              >
                Оформить
              </button>
            </article>
          ))}
        </div>
        {selectedPlanId && (
          <div style={{ marginTop: 12 }}>
            {astrocoins !== null && (
              <p className="profile-plan-hint" style={{ marginBottom: 10 }}>
                На счёте сейчас: <strong>✦ {new Intl.NumberFormat('ru-RU').format(astrocoins).replace(/\u00a0/g, ' ')}</strong>
              </p>
            )}
            <div className="profile-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={subPayLoading}
                onClick={() => void paySelectedSubscription()}
              >
                {subPayLoading
                  ? 'Списываем астрокоины…'
                  : (() => {
                      const p = SUBSCRIPTION_PLANS.find((x) => x.id === selectedPlanId);
                      return p ? `Оплатить ${formatAstrocoins(p.price)}` : 'Оплатить астрокоинами';
                    })()}
              </button>
            </div>
            {pendingSubscriptionPayment && (
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 10 }}
                disabled={checkingPaymentStatus}
                onClick={() => void refreshSubscriptionStatus()}
              >
                {checkingPaymentStatus ? 'Проверяем…' : 'Проверить статус подписки'}
              </button>
            )}
          </div>
        )}
        {subNotice && (
          <p className="profile-subscription-notice" role="status">
            {subNotice}
          </p>
        )}
      </section>

      <form className="profile-form" onSubmit={onSubmit} noValidate>
        <label className="profile-field">
          <span className="profile-label">Имя</span>
          <input
            className="profile-input"
            type="text"
            name="name"
            autoComplete="name"
            value={local.name}
            onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
            placeholder="Как к вам обращаться"
            required
          />
        </label>

        <div className="profile-row">
          <label className="profile-field">
            <span className="profile-label">Дата рождения</span>
            <span className="profile-input-host">
              <input
                className="profile-input"
                type="date"
                name="birthDate"
                value={local.birthDate}
                onChange={(e) => setLocal((p) => ({ ...p, birthDate: e.target.value }))}
                required
              />
            </span>
          </label>
          <label className="profile-field">
            <span className="profile-label">Время рождения</span>
            <span className="profile-input-host">
              <input
                className="profile-input"
                type="time"
                name="birthTime"
                value={local.birthTime}
                disabled={Boolean(local.birthTimeUnknown)}
                onChange={(e) => setLocal((p) => ({ ...p, birthTime: e.target.value, birthTimeUnknown: false }))}
                required={!local.birthTimeUnknown}
              />
            </span>
          </label>
        </div>

        <label className="profile-field profile-field--checkbox">
          <input
            type="checkbox"
            checked={Boolean(local.birthTimeUnknown)}
            onChange={(e) => {
              const checked = e.target.checked;
              setLocal((p) => ({
                ...p,
                birthTimeUnknown: checked,
                birthTime: checked ? '' : p.birthTime,
              }));
            }}
          />
          <span>Не знаю точного времени рождения</span>
        </label>

        <label className="profile-field profile-field--place">
          <span className="profile-label">Место рождения</span>
          <input
            className="profile-input"
            type="text"
            name="birthPlace"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={placeOpen && placeSuggestions.length > 0}
            aria-controls="profile-birth-place-list"
            value={local.birthPlace}
            onChange={(e) => {
              setPlaceOpen(true);
              setSelectedPlace(null);
              setLocal((p) => ({ ...p, birthPlace: e.target.value }));
            }}
            onFocus={() => {
              if (placeBlurTimer.current != null) {
                window.clearTimeout(placeBlurTimer.current);
                placeBlurTimer.current = null;
              }
              setPlaceOpen(true);
            }}
            onBlur={() => {
              placeBlurTimer.current = window.setTimeout(() => setPlaceOpen(false), 180);
            }}
            placeholder="Город"
            required
          />
          {placeOpen && local.birthPlace.trim().length >= 2 && (
            <ul id="profile-birth-place-list" className="profile-place-suggestions" role="listbox">
              {placeLoading && (
                <li>
                  <span className="profile-place-item profile-place-item--muted">Поиск…</span>
                </li>
              )}
              {!placeLoading &&
                placeSuggestions.map((s) => (
                  <li key={`${s.lat},${s.lon},${s.value}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="profile-place-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocal((p) => ({ ...p, birthPlace: s.value }));
                        setSelectedPlace(s);
                        setPlaceSuggestions([]);
                        setPlaceOpen(false);
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              {!placeLoading && placeSuggestions.length === 0 && (
                <li>
                  <span className="profile-place-item profile-place-item--empty">
                    Ничего не найдено — уточните название
                  </span>
                </li>
              )}
            </ul>
          )}
        </label>

        <fieldset className="profile-field profile-field--radio">
          <legend className="profile-label">Пол</legend>
          <div className="profile-gender-row" role="group" aria-label="Пол">
            {GENDER_OPTIONS.map((o, i) => (
              <label key={o.value} className="profile-gender-option">
                <input
                  type="radio"
                  name="gender"
                  value={o.value}
                  required={i === 0}
                  checked={local.gender === o.value}
                  onChange={() => setLocal((p) => ({ ...p, gender: o.value }))}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="profile-actions">
          <button type="submit" className="btn-primary" disabled={!dirty || saving}>
            {saving ? 'Сохраняем…' : savedFlash ? 'Сохранено' : 'Сохранить'}
          </button>
          {dirty && (
            <button type="button" className="btn-ghost" onClick={applyFromStorage}>
              Отменить
            </button>
          )}
        </div>

        {saveError && (
          <p className="profile-status" role="alert">
            <strong>Ошибка сохранения:</strong> {saveError}
          </p>
        )}

        <p className="profile-status" role="status">
          {isProfileComplete(local) ? (
            <>
              <strong>Профиль заполнен.</strong> Раздел «Астрология» доступен.
            </>
          ) : (
            <>
              Укажите имя, дату, место, пол и время (или «не знаю») — для астрологии.
            </>
          )}
        </p>
      </form>
    </div>
  );
}
