import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isNetworkApiError } from '../../api/client';
import { createInvoiceStars, crystalStarsPackages, profileGet, type CrystalPackStars } from '../../api/mysticApi';
import { pickWalletAstrocoinBalance } from '../../lib/astrocoinsBalance';
import { clearPaymentFlowState, markPaymentFlowStarted } from '../../lib/paymentFlowSession';
import { invoiceUrlFromPaymentResponse, openTelegramStarsInvoice } from '../../lib/paymentGateway';
import { formatPaymentOrOrderErrorForUser, formatPaymentUserFacingMessage } from '../../lib/paymentUserErrors';

type Props = {
  token: string;
  astrocoins: number | null;
  applyAstrocoinsFromResponse: (raw: unknown) => void;
};

function formatCoinsNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ');
}

function formatStars(n: number): string {
  return `${formatCoinsNumber(n)} ⭐`;
}

function normalizeStarsPacks(raw: unknown): CrystalPackStars[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is CrystalPackStars =>
        p != null &&
        typeof p === 'object' &&
        Number((p as CrystalPackStars).id) > 0 &&
        Number((p as CrystalPackStars).crystals) > 0 &&
        Number((p as CrystalPackStars).price_stars) > 0,
    )
    .sort((a, b) => a.crystals - b.crystals);
}

function formatTopupLoadError(error: unknown): string {
  if (error instanceof ApiError && isNetworkApiError(error)) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  }
  return 'Не удалось загрузить пакеты за звёзды. Попробуйте чуть позже.';
}

export function AstrocoinTopupStars({ token, astrocoins, applyAstrocoinsFromResponse }: Props) {
  const [packs, setPacks] = useState<CrystalPackStars[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payLoadingId, setPayLoadingId] = useState<number | null>(null);
  const [checkingTopup, setCheckingTopup] = useState(false);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPacksLoading(true);
    setPacksError(null);
    void (async () => {
      try {
        const list = await crystalStarsPackages();
        if (!cancelled) setPacks(normalizeStarsPacks(list));
      } catch (e) {
        if (!cancelled) {
          setPacksError(formatTopupLoadError(e));
          setPacks([]);
        }
      } finally {
        if (!cancelled) setPacksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tryDetectCredit = useCallback(async (): Promise<boolean> => {
    setCheckingTopup(true);
    try {
      const before = baselineRef.current;
      const data = await profileGet(token);
      applyAstrocoinsFromResponse(data);
      const after = pickWalletAstrocoinBalance(data);
      if (before !== null && after !== undefined && after > before) {
        clearPaymentFlowState();
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

  const onPayStars = async (pack: CrystalPackStars) => {
    setNotice(null);
    setPayLoadingId(pack.id);
    try {
      const raw = await createInvoiceStars({ id: pack.id }, token);
      const url = invoiceUrlFromPaymentResponse(raw);
      if (!url) {
        setNotice('Сервер не вернул invoice_url для оплаты звёздами.');
        return;
      }
      baselineRef.current = astrocoins ?? 0;
      const openRes = await openTelegramStarsInvoice(url);
      if ('error' in openRes) {
        setNotice(formatPaymentUserFacingMessage(openRes.error));
        return;
      }
      markPaymentFlowStarted('crystal_topup');
      const credited = await tryDetectCredit();
      if (!credited) {
        setNotice('Оплата прошла. Если баланс не обновился — откройте профиль снова через минуту.');
      }
    } catch (e) {
      setNotice(formatPaymentOrOrderErrorForUser(e));
    } finally {
      setPayLoadingId(null);
    }
  };

  const onCheckManual = async () => {
    const ok = await tryDetectCredit();
    if (!ok) setNotice('Пока без изменений. Если уже оплатили — подождите и нажмите «Проверить» снова.');
  };

  return (
    <div className="profile-topup-stars" aria-labelledby="profile-topup-stars-heading">
      <header className="profile-topup-stars-header">
        <h3 id="profile-topup-stars-heading" className="profile-topup-stars-title">
          Telegram Stars
        </h3>
        <p className="profile-topup-stars-lead">
          Оплата внутри Telegram — звёзды спишутся в диалоге оплаты, астрокоины придут на счёт.
        </p>
      </header>

      {packsLoading ? (
        <p className="profile-topup-status">Загружаем пакеты…</p>
      ) : packsError ? (
        <div className="profile-topup-alert profile-topup-alert--error" role="alert">
          {packsError}
        </div>
      ) : packs.length === 0 ? (
        <p className="profile-topup-status">Пакеты за звёзды пока недоступны.</p>
      ) : (
        <ul className="profile-topup-packs profile-topup-packs--stars" role="list" aria-label="Пополнение звёздами Telegram">
          {packs.map((pack) => {
            const busy = payLoadingId === pack.id;
            const disabled = payLoadingId !== null;
            const popular = pack.crystals === 1000;

            return (
              <li
                key={pack.id}
                className={
                  'profile-topup-pack' +
                  (popular ? ' profile-topup-pack--popular' : '') +
                  (disabled && !packsLoading ? ' profile-topup-pack--disabled' : '')
                }
              >
                {popular ? <span className="profile-topup-pack-badge">Популярный</span> : null}
                <div className="profile-topup-pack-body">
                  <div className="profile-topup-pack-coins" aria-label={`${pack.crystals} астрокоинов`}>
                    <span className="profile-topup-pack-symbol" aria-hidden>
                      ✦
                    </span>
                    <span className="profile-topup-pack-value">{formatCoinsNumber(pack.crystals)}</span>
                  </div>
                  <p className="profile-topup-pack-stars">{formatStars(pack.price_stars)}</p>
                </div>
                <button
                  type="button"
                  className="profile-topup-pack-btn btn-primary profile-topup-pack-btn--stars"
                  disabled={disabled || packsLoading}
                  onClick={() => void onPayStars(pack)}
                >
                  {busy ? 'Открываем…' : 'Оплатить звёздами'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="btn-ghost profile-topup-stars-check-btn"
        disabled={checkingTopup}
        onClick={() => void onCheckManual()}
      >
        {checkingTopup ? 'Проверяем…' : 'Проверить зачисление'}
      </button>

      {notice ? (
        <div className="profile-topup-alert profile-topup-alert--notice" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
