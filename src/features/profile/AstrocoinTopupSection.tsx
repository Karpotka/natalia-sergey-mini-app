import { useCallback, useEffect, useRef, useState } from 'react';
import { crystalMoneyPackages, paymentsYookassaCardInvoice, profileGet } from '../../api/mysticApi';
import { useSession } from '../../context/SessionContext';
import { pickWalletAstrocoinBalance } from '../../lib/astrocoinsBalance';
import { clearPaymentFlowState, markPaymentFlowStarted, readPaymentFlowState } from '../../lib/paymentFlowSession';
import { invoiceUrlFromPaymentResponse, openPaymentInvoiceUrl } from '../../lib/paymentGateway';
import { formatPaymentOrOrderErrorForUser, formatPaymentUserFacingMessage } from '../../lib/paymentUserErrors';
import { AstrocoinTopupTelegram } from './AstrocoinTopupTelegram';
import {
  buildMoneyPackMap,
  formatCoinsNumber,
  formatRub,
  formatTopupLoadError,
  TOPUP_AMOUNTS,
} from './topupShared';

export function AstrocoinTopupSection() {
  const { token, astrocoins, platform, applyAstrocoinsFromResponse } = useSession();
  const isTelegram = platform === 'telegram';

  const [packMeta, setPackMeta] = useState(buildMoneyPackMap([]));
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [payLoadingAmount, setPayLoadingAmount] = useState<number | null>(null);
  const [pendingTopup, setPendingTopup] = useState(false);
  const [checkingTopup, setCheckingTopup] = useState(false);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token || isTelegram) return;
    let cancelled = false;
    setPacksLoading(true);
    setPacksError(null);
    void (async () => {
      try {
        const packs = await crystalMoneyPackages();
        if (cancelled) return;
        setPackMeta(buildMoneyPackMap(Array.isArray(packs) ? packs : []));
      } catch (e) {
        if (!cancelled) {
          setPacksError(formatTopupLoadError(e));
          setPackMeta(buildMoneyPackMap([]));
        }
      } finally {
        if (!cancelled) setPacksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isTelegram]);

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
    if (!pendingTopup || !token || isTelegram) return;
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
  }, [pendingTopup, token, tryDetectCredit, isTelegram]);

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
          {isTelegram
            ? 'Выберите сумму и способ оплаты — всё в одном экране.'
            : 'Оплата картой через ЮKassa. Астрокоины — для подписки, Таро и гороскопов.'}
        </p>
        {!isTelegram ? (
          <p className="profile-topup-rate" aria-label="Курс: один рубль равен одному астрокоину">
            <span className="profile-topup-rate-item">1 ₽</span>
            <span className="profile-topup-rate-arrow" aria-hidden>
              →
            </span>
            <span className="profile-topup-rate-item profile-topup-rate-item--gold">1 ✦</span>
          </p>
        ) : null}
      </header>

      {isTelegram ? (
        <AstrocoinTopupTelegram
          token={token}
          astrocoins={astrocoins}
          applyAstrocoinsFromResponse={applyAstrocoinsFromResponse}
        />
      ) : (
        <>
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
                    'profile-topup-pack' +
                    (popular ? ' profile-topup-pack--popular' : '') +
                    (disabled && !packsLoading ? ' profile-topup-pack--disabled' : '')
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
              <button
                type="button"
                className="btn-ghost profile-topup-check-btn"
                disabled={checkingTopup}
                onClick={() => void onCheckManual()}
              >
                {checkingTopup ? 'Проверяем…' : 'Проверить зачисление'}
              </button>
            </div>
          ) : null}

          {notice ? (
            <div className="profile-topup-alert profile-topup-alert--notice" role="status">
              {notice}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
