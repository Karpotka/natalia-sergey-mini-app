import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { isBackendEnabled } from '../api/config';
import {
  serviceCatalog,
  serviceConsultYookassaInvoice,
  type ServiceCatalogItem,
} from '../api/mysticApi';
import { useProfile, type UserGender, type UserProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import { invoiceUrlFromPaymentResponse, openPaymentInvoiceUrl } from '../lib/paymentGateway';
import { formatConsultApiErrorForUser, formatPaymentUserFacingMessage } from '../lib/paymentUserErrors';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
];

/** Один эксперт в продукте — имя для UI и заявок. */
const EXPERT_NAME = 'Наталья Веспер';
const EXPERT_MONOGRAM = 'НВ';

type ConsultDraft = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  gender: UserGender | '';
  interest: string;
};

function normalizeServiceCatalog(raw: unknown): ServiceCatalogItem[] {
  if (Array.isArray(raw)) return raw as ServiceCatalogItem[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of ['items', 'services', 'catalog', 'data', 'list']) {
      const v = o[k];
      if (Array.isArray(v)) return v as ServiceCatalogItem[];
    }
  }
  return [];
}

function readEnvServiceId(...keys: (string | undefined)[]): number | null {
  for (const raw of keys) {
    const s = String(raw ?? '').trim();
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

/** Явный id услуги: сначала Веспер, затем прежние переменные (одна позиция каталога на всех). */
function envConsultServiceIdOverride(): number | null {
  return readEnvServiceId(
    import.meta.env.VITE_CONSULT_SERVICE_ID_VESPER,
    import.meta.env.VITE_CONSULT_SERVICE_ID_UNIVERSAL,
    import.meta.env.VITE_CONSULT_PRODUCT_ID_UNIVERSAL,
    import.meta.env.VITE_CONSULT_SERVICE_ID_ASTROLOGER,
    import.meta.env.VITE_CONSULT_PRODUCT_ID_ASTROLOGER,
    import.meta.env.VITE_CONSULT_SERVICE_ID_TAROLOGIST,
    import.meta.env.VITE_CONSULT_PRODUCT_ID_TAROLOGIST,
  );
}

function resolveConsultService(catalog: ServiceCatalogItem[]): ServiceCatalogItem | null {
  const override = envConsultServiceIdOverride();
  if (!catalog.length) {
    if (override != null) {
      return {
        id: override,
        title: `Личная консультация — ${EXPERT_NAME}`,
        description: 'Услуга задана через переменные сборки (каталог не загрузился).',
        price_money: 0,
      };
    }
    return null;
  }
  if (override != null) {
    const byId = catalog.find((x) => x.id === override);
    if (byId) return byId;
  }
  const nameHints = [/веспер/i, /vesper/i, /наталья/i, /natalya/i, /natalia/i];
  const topicHints = [/консульт/i, /персональн/i, /астролог/i, /\bastro/i, /таролог/i, /\btarot/i, /\bтаро\b/i];
  for (const item of catalog) {
    const blob = `${item.title}\n${item.description ?? ''}`;
    if (nameHints.some((re) => re.test(blob))) return item;
    if (topicHints.some((re) => re.test(blob))) return item;
  }
  if (catalog.length === 1) return catalog[0];
  return null;
}

function buildConsultInputData(draft: ConsultDraft, item: ServiceCatalogItem): Record<string, unknown> {
  const problem = draft.interest.trim();
  const wide: Record<string, unknown> = {
    expert_key: 'natalya_vesper',
    client_name: draft.name.trim(),
    name: draft.name.trim(),
    birth_date: draft.birthDate,
    birth_time: draft.birthTime,
    birth_place: draft.birthPlace,
    gender: draft.gender || undefined,
    description: problem,
    problem_description: problem,
    problem,
    message: problem,
  };
  const schema = item.input_schema;
  if (schema && typeof schema === 'object' && 'properties' in schema) {
    const props = (schema as { properties?: Record<string, unknown> }).properties;
    if (props && typeof props === 'object') {
      const allowed = new Set(Object.keys(props));
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(wide)) {
        if (allowed.has(k)) out[k] = v;
      }
      const textKeys = ['description', 'problem', 'message', 'comment', 'request', 'details', 'text', 'body'];
      for (const tk of textKeys) {
        if (allowed.has(tk)) {
          out[tk] = problem;
          break;
        }
      }
      if (Object.keys(out).length > 0) return out;
    }
  }
  return wide;
}

function formatRub(amount: number): string {
  try {
    return `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`;
  } catch {
    return `${amount} ₽`;
  }
}

function profileToDraft(p: UserProfile): ConsultDraft {
  return {
    name: p.name,
    birthDate: p.birthDate,
    birthTime: p.birthTime,
    birthPlace: p.birthPlace,
    gender: p.gender,
    interest: '',
  };
}

export function ConsultationsPage() {
  const { token, authMode } = useSession();
  const { profile } = useProfile();
  const [, setSearchParams] = useSearchParams();
  const apiOn = isBackendEnabled();

  const [consultOpen, setConsultOpen] = useState(false);
  const [draft, setDraft] = useState<ConsultDraft>(() => profileToDraft(profile));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [payEmail, setPayEmail] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!apiOn || !token) {
      setCatalog([]);
      setCatalogError(null);
      setCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void serviceCatalog(token)
      .then((raw) => {
        if (cancelled) return;
        setCatalog(normalizeServiceCatalog(raw));
      })
      .catch((e) => {
        if (cancelled) return;
        setCatalog([]);
        setCatalogError(formatConsultApiErrorForUser(e));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, token]);

  const openConsultForm = useCallback(() => {
    setSubmitted(false);
    setPayEmail('');
    setPayLoading(false);
    setFormError(null);
    setDraft(profileToDraft(profile));
    setConsultOpen(true);
  }, [profile]);

  const closeForm = useCallback(() => {
    setConsultOpen(false);
    setFormError(null);
    setSubmitted(false);
    setPayLoading(false);
  }, []);

  useEffect(() => {
    if (!consultOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [consultOpen]);

  useEffect(() => {
    if (!consultOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [consultOpen, closeForm]);

  useEffect(() => {
    if (!consultOpen || submitted) return;
    const t = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('input,textarea')?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [consultOpen, submitted]);

  const selectedService = useMemo(() => resolveConsultService(catalog), [catalog]);

  const proceedToPayment = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!token) {
      setFormError('Для оплаты войдите через VK.');
      return;
    }
    if (catalogLoading) {
      setFormError('Подождите, загружается список услуг…');
      return;
    }
    if (!catalog.length && !selectedService) {
      setFormError(
        catalogError ??
          'Консультация временно недоступна. Попробуйте позже.',
      );
      return;
    }
    if (!selectedService) {
      setFormError(
        'Услуга не найдена. Напишите в поддержку.',
      );
      return;
    }
    if (!draft.interest.trim()) {
      setFormError('Опишите ваш запрос — без этого заявку нельзя передать специалисту.');
      return;
    }

    const email = payEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Нужен email для чека и связи.');
      return;
    }

    setPayLoading(true);
    setFormError(null);
    try {
      const input_data = buildConsultInputData(draft, selectedService);
      const serviceId = selectedService.id;
      const raw = await serviceConsultYookassaInvoice(
        {
          service_id: serviceId,
          email: payEmail.trim(),
          pay_method: 'card',
          input_data,
        },
        token,
      );
      const url = invoiceUrlFromPaymentResponse(raw);
      if (!url) {
        setFormError('Не удалось получить ссылку на оплату. Попробуйте ещё раз чуть позже.');
        return;
      }
      const openRes = await openPaymentInvoiceUrl(url);
      if ('error' in openRes) {
        setFormError(formatPaymentUserFacingMessage(openRes.error));
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setFormError(formatConsultApiErrorForUser(err));
    } finally {
      setPayLoading(false);
    }
  };

  const modal =
    consultOpen &&
    createPortal(
      <div
        className="consult-form-backdrop"
        role="presentation"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) closeForm();
        }}
      >
        <div
          ref={dialogRef}
          className="consult-form-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consult-form-title"
        >
          <div className="consult-form-head">
            <h2 id="consult-form-title" className="consult-form-title">
              Заявка: {EXPERT_NAME}
            </h2>
            <button type="button" className="consult-form-close" onClick={closeForm} aria-label="Закрыть">
              ×
            </button>
          </div>

          {submitted ? (
            <div className="consult-form-success">
              <p>Оплата открыта в новом окне. Вопросы — в поддержку.</p>
              <button type="button" className="btn-primary" onClick={closeForm}>
                Закрыть
              </button>
            </div>
          ) : (
            <>
              <p className="consult-form-lead">
                Данные из кабинета — можно изменить здесь или{' '}
                <button type="button" className="consult-form-inline-link" onClick={openCabinet}>
                  в профиле
                </button>
                .
              </p>
              {token && catalogLoading ? (
                <p className="consult-form-lead">Загружаем каталог услуг…</p>
              ) : null}
              {token && !catalogLoading && selectedService ? (
                <p className="consult-form-lead" style={{ marginTop: 8 }}>
                  Услуга: <strong>{selectedService.title}</strong>
                  {typeof selectedService.price_money === 'number' && selectedService.price_money > 0 ? (
                    <>
                      {' '}
                      · ориентир <strong>{formatRub(selectedService.price_money)}</strong>
                    </>
                  ) : (
                    <> · сумма появится на шаге оплаты</>
                  )}
                </p>
              ) : null}
              {token && !catalogLoading && catalog.length > 0 && !selectedService ? (
                <p className="consult-form-error" role="alert">
                  Услуга не найдена. Напишите в поддержку.
                </p>
              ) : null}

              <form className="consult-form" onSubmit={(ev) => void proceedToPayment(ev)} noValidate>
                <label className="profile-field">
                  <span className="profile-label">Имя</span>
                  <input
                    className="profile-input"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Как к вам обращаться"
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
                        value={draft.birthDate}
                        onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
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
                        value={draft.birthTime}
                        onChange={(e) => setDraft((d) => ({ ...d, birthTime: e.target.value }))}
                      />
                    </span>
                  </label>
                </div>

                <label className="profile-field">
                  <span className="profile-label">Место рождения</span>
                  <input
                    className="profile-input"
                    type="text"
                    name="birthPlace"
                    autoComplete="off"
                    value={draft.birthPlace}
                    onChange={(e) => setDraft((d) => ({ ...d, birthPlace: e.target.value }))}
                    placeholder="Город / населённый пункт"
                  />
                </label>

                <fieldset className="profile-field profile-field--radio">
                  <legend className="profile-label">Пол</legend>
                  <div className="profile-gender-row" role="group" aria-label="Пол">
                    {GENDER_OPTIONS.map((o) => (
                      <label key={o.value} className="profile-gender-option">
                        <input
                          type="radio"
                          name="consult-gender"
                          value={o.value}
                          checked={draft.gender === o.value}
                          onChange={() => setDraft((d) => ({ ...d, gender: o.value }))}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="profile-field">
                  <span className="profile-label">Ваш запрос к Наталье</span>
                  <textarea
                    className="profile-input consult-form-textarea"
                    name="interest"
                    rows={5}
                    value={draft.interest}
                    onChange={(e) => setDraft((d) => ({ ...d, interest: e.target.value }))}
                    placeholder="Тема, формат (чат/аудио/видео), когда связаться"
                    required
                  />
                </label>

                <label className="profile-field">
                  <span className="profile-label">Email для чека ЮKassa</span>
                  <input
                    className="profile-input"
                    type="email"
                    value={payEmail}
                    onChange={(e) => setPayEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                {formError && (
                  <p className="consult-form-error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="consult-form-actions">
                  <button
                    type="submit"
                    className="consult-cta-primary"
                    disabled={payLoading || (Boolean(token) && catalogLoading) || (Boolean(token) && !selectedService)}
                  >
                    {payLoading ? 'Открываем оплату…' : 'Оплатить картой'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="product-page">
      <section className="product-hero product-hero--consult consult-landing">
        <div className="consult-landing-inner">
          <p className="consult-kicker">Персональная сессия</p>
          <h1>Личная консультация</h1>
          <p className="consult-lead">
            Сессия с <strong>{EXPERT_NAME}</strong>: <strong>таро</strong> и <strong>астрология</strong>. Данные из
            кабинета, запрос — в форме.
          </p>

          <div className="consult-price-note" role="note">
            <span className="consult-price-note-icon" aria-hidden>
              ✦
            </span>
            <span className="consult-price-note-text">
              <strong>Цена по услуге</strong> — сумма перед оплатой.
            </span>
          </div>

          {apiOn && token && catalogError ? <p className="consult-form-error">{catalogError}</p> : null}
          {apiOn && token && catalogLoading ? <p className="consult-catalog-hint">Загружаем каталог услуг…</p> : null}

          <article className="consult-expert-solo">
            <div className="consult-expert-solo-visual" aria-hidden>
              <div className="consult-expert-solo-orbit" />
              <div className="consult-expert-solo-badge">{EXPERT_MONOGRAM}</div>
            </div>
            <div className="consult-expert-solo-body">
              <h2 className="consult-expert-solo-name">{EXPERT_NAME}</h2>
              <p className="consult-expert-solo-role">Таро · астрология · персональный разбор</p>
              <p className="consult-expert-solo-desc">
                Таро и астрология, опыт и бережный тон. Помощь в решениях.
              </p>
              <button type="button" className="consult-cta-primary" onClick={openConsultForm}>
                Записаться
              </button>
            </div>
          </article>

          {apiOn && (
            <p className="consult-footnote">
              {!token && authMode !== 'dev_token' && authMode !== 'vk_token' && authMode !== 'idle' ? (
                <>Войдите через VK для заявки и оплаты.</>
              ) : token ? (
                <>После формы — оплата картой. Чек на email.</>
              ) : (
                <>Войдите через VK для заявки.</>
              )}
            </p>
          )}
        </div>
      </section>

      {modal}
    </div>
  );
}
