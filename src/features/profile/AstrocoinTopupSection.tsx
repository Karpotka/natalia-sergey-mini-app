import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isNetworkApiError } from '../../api/client';
import {
  crystalMoneyPackages,
  paymentsYookassaCardInvoice,
  profileGet,
  type CrystalPackMoney,
} from '../../api/mysticApi';
import { useSession } from '../../context/SessionContext';
import { pickWalletAstrocoinBalance } from '../../lib/astrocoinsBalance';
import { clearPaymentFlowState, markPaymentFlowStarted, readPaymentFlowState } from '../../lib/paymentFlowSession';
import { invoiceUrlFromPaymentResponse, openPaymentInvoiceUrl } from '../../lib/paymentGateway';
import { formatPaymentOrOrderErrorForUser, formatPaymentUserFacingMessage } from '../../lib/paymentUserErrors';

const TOPUP_AMOUNTS = [100, 500, 1000, 3000, 5000] as const;

type PackMeta = { id: number; priceMoney?: number };

function formatCoinsNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ');
}

function formatRub(n: number): string {
  return formatCoinsNumber(n) + ' ₽';
}

function readCrystalPackIdFromEnv(amount: number): number | null {
  const key =
    amount === 100
      ? 'VITE_CRYSTAL_PACK_ID_100'
      : amount === 500
        ? 'VITE_CRYSTAL_PACK_ID_500'
        : amount === 1000
          ? 'VITE_CRYSTAL_PACK_ID_1000'
          : amount === 3000
            ? 'VITE_CRYSTAL_PACK_ID_3000'
            : amount === 5000
              ? 'VITE_CRYSTAL_PACK_ID_5000'
              : '';
  if (!key) return null;
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function buildPackMap(packs: CrystalPackMoney[]): Partial<Record<number, PackMeta>> {
  const out: Partial<Record<number, PackMeta>> = {};
  for (const amount of TOPUP_AMOUNTS) {
    const fromEnv = readCrystalPackIdFromEnv(amount);
    if (fromEnv) {
      const row = packs.find((p) => p.id === fromEnv);
      out[amount] = {
        id: fromEnv,
        priceMoney: row && Number.isFinite(row.price_money) ? Math.round(row.price_money) : amount,
      };
      continue;
    }
    const row = packs.find((p) => Number(p.crystals) === amount);
    if (row?.id && row.id > 0) {
      out[amount] = {
        id: row.id,
        priceMoney: Number.isFinite(row.price_money) ? Math.round(row.price_money) : amount,
      };
    }
  }
  return out;
}

function formatTopupLoadError(error: unknown): string {
  if (error instanceof ApiError && isNetworkApiError(error)) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  }
  return 'Не удалось загрузить номиналы. Попробуйте чуть позже.';
}

export function AstrocoinTopupSection() {
  const { token, astrocoins, applyAstrocoinsFromResponse } = useSession();
  const [packMeta, setPackMeta] = useState<Partial<Record<number, PackMeta>>>({});
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [payLoadingAmount, setPayLoadingAmount] = useState<number | null>(null);
  const [pendingTopup, setPendingTopup] = useState(false);
  const [checkingTopup, setCheckingTopup] = useState(false);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPacksLoading(true);
    setPacksError(null);
    void (async () => {
      try {
        const packs = await crystalMoneyPackages();
        if (cancelled) return;
        setPackMeta(buildPackMap(Array.isArray(packs) ? packs : []));
      } catch (e) {
        if (!cancelled) {
          setPacksError(formatTopupLoadError(e));
          setPackMeta(buildPackMap([]));
        }
      } finally {
        if (!cancelled) setPacksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    setPendingTopup(readPaymentFlowState()?.kind === 'crystal_topup');
  }, []);

  const tryDetectCredit = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    setCheckingTopup(true);
    try {
      const before = baselineRef.current;
      const data = await profileGet(token);
      applyAstrocoinsFromResponse(data);
      const after = pickWalletAstrocoinBalance(data);
      if (before !== null && after !== undefined && after > before) {
        clearPaymentFlowState();
        setPendingTopup(false);
        baselineRef.current = null;
        setNotice('Астрокоины зачислены на счёт.');
        return true;
      }
      return false;
    } catch (e) {
      setNotice(formatPaymentOrOrderErrorForUser(e));
      return false;
    } finally {
      setCheckingTopup(false);
    }
  }, [token, applyAstrocoinsFromResponse]);

  useEffect(() => {
    if (!pendingTopup || !token) return;
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      if (stopped) return;
      tries += 1;
      const ok = await tryDetectCredit();
      if (stopped || ok) return;
      if (tries < 6) window.setTimeout(tick, 3500);
    };
    window.setTimeout(tick, 1200);
    return () => {
      stopped = true;
    };
  }, [pendingTopup, token, tryDetectCredit]);

  const onPay = async (amount: number) => {
    setNotice(null);
    if (!token) {
      setNotice('Войдите через VK, чтобы пополнить счёт.');
      return;
    }
    const meta = packMeta[amount];
    if (!meta?.id) {
      setNotice('Этот номинал временно недоступен.');
      return;
    }
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNotice('Укажите email для чека ЮKassa.');
      return;
    }
    setPayLoadingAmount(amount);
    try {
      const raw = await paymentsYookassaCardInvoice({ id: meta.id, email: trimmed }, token);
      const url = invoiceUrlFromPaymentResponse(raw);
      if (!url) {
        setNotice('Сервер не вернул ссылку на оплату.');
        return;
      }
      baselineRef.current = astrocoins ?? 0;
      const openRes = await openPaymentInvoiceUrl(url);
      if ('error' in openRes) {
        setNotice(formatPaymentUserFacingMessage(openRes.error));
        return;
      }
      markPaymentFlowStarted('crystal_topup');
      setPendingTopup(true);
      setNotice('Оплата открыта в ЮKassa. Баланс обновится автоматически.');
    } catch (e) {
      setNotice(formatPaymentOrOrderErrorForUser(e));
    } finally {
      setPayLoadingAmount(null);
    }
  };

  const onCheckManual = async () => {
    const ok = await tryDetectCredit();
    if (!ok) {
      setNotice('Пока без изменений. Завершите оплату в ЮKassa и нажмите «Проверить» снова.');
    }
  };

  if (!token) return null;

  return (
    <section className="profile-topup" aria-labelledby="profile-topup-heading">
      <header className="profile-topup-header">
        <h2 id="profile-topup-heading" className="profile-topup-title">
          Пополнение
        </h2>
        <p className="profile-topup-lead">
          Оплата картой через ЮKassa. На счёт зачисляются астрокоины для подписки, Таро и гороскопов.
        </p>
        <p className="profile-topup-rate" aria-label="Курс: один рубль равен одному астрокоину">
          <span className="profile-topup-rate-item">1 ₽</span>
          <span className="profile-topup-rate-arrow" aria-hidden>
            →
          </span>
          <span className="profile-topup-rate-item profile-topup-rate-item--gold">1 ✦</span>
        </p>
      </header>

      <label className="profile-topup-email">
        <span className="profile-topup-email-label">Email для чека</span>
        <input
          className="profile-topup-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          inputMode="email"
        />
      </label>

      {packsLoading ? (
        <p className="profile-topup-status">Загружаем номиналы…</p>
      ) : packsError ? (
        <div className="profile-topup-alert profile-topup-alert--error" role="alert">
          {packsError}
        </div>
      ) : null}

      <ul className="profile-topup-packs" role="list" aria-label="Номиналы пополнения">
        {TOPUP_AMOUNTS.map((amount) => {
          const meta = packMeta[amount];
          const rub = meta?.priceMoney ?? amount;
          const busy = payLoadingAmount === amount;
          const disabled = !meta?.id || payLoadingAmount !== null;
          const popular = amount === 1000;

          return (
            <li
              key={amount}
              className={
                'profile-topup-pack' + (popular ? ' profile-topup-pack--popular' : '') + (disabled && !packsLoading ? ' profile-topup-pack--disabled' : '')
              }
            >
              {popular ? <span className="profile-topup-pack-badge">Популярный</span> : null}
              <div className="profile-topup-pack-body">
                <div className="profile-topup-pack-coins" aria-label={`${amount} астрокоинов`}>
                  <span className="profile-topup-pack-symbol" aria-hidden>
                    ✦
                  </span>
                  <span className="profile-topup-pack-value">{formatCoinsNumber(amount)}</span>
                </div>
                <p className="profile-topup-pack-rub">{formatRub(rub)}</p>
              </div>
              <button
                type="button"
                className="profile-topup-pack-btn btn-primary"
                disabled={disabled || packsLoading}
                onClick={() => void onPay(amount)}
              >
                {busy ? 'Открываем…' : 'Оплатить'}
              </button>
            </li>
          );
        })}
      </ul>

      {pendingTopup ? (
        <div className="profile-topup-pending">
          <p className="profile-topup-pending-text">Ожидаем оплату в ЮKassa</p>
          <button type="button" className="btn-ghost profile-topup-check-btn" disabled={checkingTopup} onClick={() => void onCheckManual()}>
            {checkingTopup ? 'Проверяем…' : 'Проверить зачисление'}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="profile-topup-alert profile-topup-alert--notice" role="status">
          {notice}
        </div>
      ) : null}
    </section>
  );
}
