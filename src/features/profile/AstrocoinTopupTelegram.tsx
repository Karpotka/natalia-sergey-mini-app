import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInvoiceStars,
  crystalMoneyPackages,
  crystalStarsPackages,
  paymentsYookassaCardInvoice,
  profileGet,
  type CrystalPackStars,
} from '../../api/mysticApi';
import { pickWalletAstrocoinBalance } from '../../lib/astrocoinsBalance';
import { clearPaymentFlowState, markPaymentFlowStarted, readPaymentFlowState } from '../../lib/paymentFlowSession';
import { invoiceUrlFromPaymentResponse, openPaymentInvoiceUrl, openTelegramStarsInvoice } from '../../lib/paymentGateway';
import { formatPaymentOrOrderErrorForUser, formatPaymentUserFacingMessage } from '../../lib/paymentUserErrors';
import {
  buildMoneyPackMap,
  formatCoinsNumber,
  formatRub,
  formatStars,
  formatTopupLoadError,
  TOPUP_AMOUNTS,
  type PackMeta,
} from './topupShared';

type PayMethod = 'stars' | 'card';

type Props = {
  token: string;
  astrocoins: number | null;
  applyAstrocoinsFromResponse: (raw: unknown) => void;
};

function normalizeStarsPacks(raw: unknown): CrystalPackStars[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is CrystalPackStars =>
        p != null &&
        typeof p === 'object' &&
        Number(p.id) > 0 &&
        Number(p.crystals) > 0 &&
        Number(p.price_stars) > 0,
    )
    .sort((a, b) => a.crystals - b.crystals);
}

export function AstrocoinTopupTelegram({ token, astrocoins, applyAstrocoinsFromResponse }: Props) {
  const [method, setMethod] = useState<PayMethod>('stars');
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [moneyPacks, setMoneyPacks] = useState<Partial<Record<number, PackMeta>>>({});
  const [starsPacks, setStarsPacks] = useState<CrystalPackStars[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [pendingTopup, setPendingTopup] = useState(false);
  const [checkingTopup, setCheckingTopup] = useState(false);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const [money, stars] = await Promise.all([crystalMoneyPackages(), crystalStarsPackages()]);
        if (cancelled) return;
        setMoneyPacks(buildMoneyPackMap(Array.isArray(money) ? money : []));
        setStarsPacks(normalizeStarsPacks(stars));
      } catch (e) {
        if (!cancelled) {
          setLoadError(formatTopupLoadError(e));
          setMoneyPacks(buildMoneyPackMap([]));
          setStarsPacks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPendingTopup(readPaymentFlowState()?.kind === 'crystal_topup');
  }, []);

  const starsByCrystals = useMemo(() => {
    const m = new Map<number, CrystalPackStars>();
    for (const p of starsPacks) m.set(p.crystals, p);
    return m;
  }, [starsPacks]);

  const availableAmounts = useMemo(() => {
    return TOPUP_AMOUNTS.filter((amount) => {
      if (method === 'stars') return starsByCrystals.has(amount);
      return Boolean(moneyPacks[amount]?.id);
    });
  }, [method, starsByCrystals, moneyPacks]);

  useEffect(() => {
    if (availableAmounts.length === 0) return;
    if (!availableAmounts.includes(selectedAmount as (typeof TOPUP_AMOUNTS)[number])) {
      setSelectedAmount(availableAmounts.includes(1000) ? 1000 : availableAmounts[0]);
    }
  }, [availableAmounts, selectedAmount]);

  const selectedStars = starsByCrystals.get(selectedAmount);
  const selectedMoney = moneyPacks[selectedAmount];
  const canPay = method === 'stars' ? Boolean(selectedStars) : Boolean(selectedMoney?.id);

  const priceLine =
    method === 'stars' && selectedStars
      ? formatStars(selectedStars.price_stars)
      : selectedMoney
        ? formatRub(selectedMoney.priceMoney ?? selectedAmount)
        : '—';

  const tryDetectCredit = useCallback(async (): Promise<boolean> => {
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
        setNotice('Астрокоины зачислены на счёт ✦');
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
    if (!pendingTopup) return;
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
  }, [pendingTopup, tryDetectCredit]);

  const onPay = async () => {
    setNotice(null);
    if (!canPay) {
      setNotice('Выберите другой номинал или способ оплаты.');
      return;
    }

    setPayBusy(true);
    baselineRef.current = astrocoins ?? 0;

    try {
      if (method === 'stars' && selectedStars) {
        const raw = await createInvoiceStars({ id: selectedStars.id }, token);
        const url = invoiceUrlFromPaymentResponse(raw);
        if (!url) {
          setNotice('Сервер не вернул ссылку на оплату звёздами.');
          return;
        }
        const openRes = await openTelegramStarsInvoice(url);
        if ('error' in openRes) {
          setNotice(formatPaymentUserFacingMessage(openRes.error));
          return;
        }
        markPaymentFlowStarted('crystal_topup');
        const credited = await tryDetectCredit();
        if (!credited) {
          setNotice('Оплата принята. Баланс обновится через несколько секунд — нажмите «Проверить».');
        }
        return;
      }

      if (method === 'card' && selectedMoney) {
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          setNotice('Укажите email — он нужен для чека ЮKassa.');
          return;
        }
        const raw = await paymentsYookassaCardInvoice({ id: selectedMoney.id, email: trimmed }, token);
        const url = invoiceUrlFromPaymentResponse(raw);
        if (!url) {
          setNotice('Сервер не вернул ссылку на оплату.');
          return;
        }
        const openRes = await openPaymentInvoiceUrl(url);
        if ('error' in openRes) {
          setNotice(formatPaymentUserFacingMessage(openRes.error));
          return;
        }
        markPaymentFlowStarted('crystal_topup');
        setPendingTopup(true);
        setNotice('Открылся экран оплаты картой. После оплаты баланс обновится автоматически.');
      }
    } catch (e) {
      setNotice(formatPaymentOrOrderErrorForUser(e));
    } finally {
      setPayBusy(false);
    }
  };

  const onCheckManual = async () => {
    const ok = await tryDetectCredit();
    if (!ok) {
      setNotice(
        method === 'card'
          ? 'Пока без изменений. Завершите оплату в ЮKassa и нажмите «Проверить».'
          : 'Пока без изменений. Если звёзды уже списались — подождите минуту и проверьте снова.',
      );
    }
  };

  return (
    <div className="profile-topup-tg">
      {astrocoins !== null ? (
        <p className="profile-topup-balance" aria-live="polite">
          На счёте <strong>{formatCoinsNumber(astrocoins)} ✦</strong>
        </p>
      ) : null}

      <div className="profile-topup-method" role="tablist" aria-label="Способ оплаты">
        <button
          type="button"
          role="tab"
          aria-selected={method === 'stars'}
          className={'profile-topup-method-btn' + (method === 'stars' ? ' profile-topup-method-btn--active' : '')}
          onClick={() => {
            setMethod('stars');
            setNotice(null);
          }}
        >
          <span className="profile-topup-method-icon" aria-hidden>
            ⭐
          </span>
          <span className="profile-topup-method-text">
            <span className="profile-topup-method-name">Звёзды</span>
            <span className="profile-topup-method-hint">Оплата звёздами</span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'card'}
          className={'profile-topup-method-btn' + (method === 'card' ? ' profile-topup-method-btn--active' : '')}
          onClick={() => {
            setMethod('card');
            setNotice(null);
          }}
        >
          <span className="profile-topup-method-icon" aria-hidden>
            💳
          </span>
          <span className="profile-topup-method-text">
            <span className="profile-topup-method-name">Карта</span>
            <span className="profile-topup-method-hint">ЮKassa, чек на email</span>
          </span>
        </button>
      </div>

      <p className="profile-topup-step-label">Сумма пополнения</p>
      {loading ? (
        <p className="profile-topup-status">Загружаем номиналы…</p>
      ) : loadError ? (
        <div className="profile-topup-alert profile-topup-alert--error" role="alert">
          {loadError}
        </div>
      ) : availableAmounts.length === 0 ? (
        <p className="profile-topup-status">Номиналы для этого способа временно недоступны.</p>
      ) : (
        <div className="profile-topup-chips" role="group" aria-label="Выбор суммы астрокоинов">
          {TOPUP_AMOUNTS.map((amount) => {
            const ok =
              method === 'stars' ? starsByCrystals.has(amount) : Boolean(moneyPacks[amount]?.id);
            if (!ok) return null;
            const selected = selectedAmount === amount;
            const popular = amount === 1000;
            return (
              <button
                key={amount}
                type="button"
                className={
                  'profile-topup-chip' +
                  (selected ? ' profile-topup-chip--selected' : '') +
                  (popular ? ' profile-topup-chip--popular' : '')
                }
                aria-pressed={selected}
                onClick={() => setSelectedAmount(amount)}
              >
                {popular ? <span className="profile-topup-chip-tag">Топ</span> : null}
                <span className="profile-topup-chip-coins">{formatCoinsNumber(amount)}</span>
                <span className="profile-topup-chip-unit">✦</span>
              </button>
            );
          })}
        </div>
      )}

      {method === 'card' ? (
        <label className="profile-topup-email profile-topup-email--inline">
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
      ) : null}

      <div className="profile-topup-checkout">
        <div className="profile-topup-checkout-summary">
          <span className="profile-topup-checkout-label">К оплате</span>
          <span className="profile-topup-checkout-price">{priceLine}</span>
          <span className="profile-topup-checkout-coins">
            +{formatCoinsNumber(selectedAmount)} ✦ на счёт
          </span>
        </div>
        <button
          type="button"
          className="btn-primary profile-topup-checkout-btn"
          disabled={!canPay || payBusy || loading}
          onClick={() => void onPay()}
        >
          {payBusy
            ? 'Открываем оплату…'
            : method === 'stars'
              ? `Оплатить ${priceLine}`
              : `Оплатить картой ${priceLine}`}
        </button>
      </div>

      {pendingTopup && method === 'card' ? (
        <div className="profile-topup-pending profile-topup-pending--compact">
          <p className="profile-topup-pending-text">Ожидаем оплату картой…</p>
        </div>
      ) : null}

      <button
        type="button"
        className="btn-ghost profile-topup-check-btn"
        disabled={checkingTopup}
        onClick={() => void onCheckManual()}
      >
        {checkingTopup ? 'Проверяем…' : 'Проверить зачисление'}
      </button>

      {notice ? (
        <div
          className={
            'profile-topup-alert profile-topup-alert--notice' +
            (notice.includes('зачислены') ? ' profile-topup-alert--success' : '')
          }
          role="status"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}
