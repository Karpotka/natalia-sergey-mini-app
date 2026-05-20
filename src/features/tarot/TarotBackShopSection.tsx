import { useCallback, useState } from 'react';
import { useSession } from '../../context/SessionContext';

/** Витрина покупки обложек — только VK и браузер (в Telegram см. TarotBackEquipStrip). */
import { useTarotBackSkin } from '../../context/TarotBackSkinContext';
import { localTarotBackImageUrl } from './tarotBackCatalog';

function shopBuyMessage(
  status: 'ok' | 'already_bought' | 'not_enough' | 'error',
): string {
  switch (status) {
    case 'ok':
      return 'Куплено. Нажмите «Надеть».';
    case 'already_bought':
      return 'Уже в коллекции.';
    case 'not_enough':
      return 'Недостаточно астрокоинов.';
    case 'error':
      return 'Покупка не удалась. Попробуйте ещё раз.';
    default:
      return 'Не получилось завершить покупку.';
  }
}

export function TarotBackShopSection() {
  const { token, astrocoins } = useSession();
  const {
    shopItems,
    shopLoading,
    refreshTarotBackShop,
    equipTarotBack,
    buyTarotBack,
  } = useTarotBackSkin();
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const onBuy = useCallback(
    async (itemId: number) => {
      setNotice(null);
      setBusyId(itemId);
      try {
        const status = await buyTarotBack(itemId);
        setNotice(shopBuyMessage(status));
        if (status === 'ok' || status === 'already_bought') {
          await refreshTarotBackShop();
        }
      } finally {
        setBusyId(null);
      }
    },
    [buyTarotBack, refreshTarotBackShop],
  );

  const onEquip = useCallback(
    async (itemId: number) => {
      setNotice(null);
      setBusyId(itemId);
      try {
        const s = await equipTarotBack(itemId);
        if (s === 'ok') {
          setNotice('Рубашка активна в Таро и карте дня.');
          await refreshTarotBackShop();
        } else if (s === 'not_owned') {
          setNotice('Сначала купите эту обложку.');
        } else {
          setNotice('Не удалось применить обложку.');
        }
      } finally {
        setBusyId(null);
      }
    },
    [equipTarotBack, refreshTarotBackShop],
  );

  if (shopItems.length === 0 && shopLoading) {
    return (
      <section className="profile-tarot-shop" aria-labelledby="profile-tarot-shop-heading">
        <h2 id="profile-tarot-shop-heading" className="profile-tarot-shop-title">
          Обложки Таро
        </h2>
        <p className="profile-tarot-shop-lead">Загружаем каталог…</p>
      </section>
    );
  }

  return (
    <section className="profile-tarot-shop" aria-labelledby="profile-tarot-shop-heading">
      <h2 id="profile-tarot-shop-heading" className="profile-tarot-shop-title">
        Обложки Таро
      </h2>
      <p className="profile-tarot-shop-lead">
        Рубашка для раскладов и карты дня. Купить и «Надеть».
      </p>
      {!token ? (
        <p className="profile-tarot-shop-lead" style={{ marginTop: 0 }}>
          Войдите через VK, чтобы покупать обложки за астрокоины. Надеть бесплатную можно сразу.
        </p>
      ) : null}
      {astrocoins !== null && (
        <p className="profile-tarot-shop-balance" role="status">
          Сейчас на счёте: <span className="profile-tarot-shop-balance-value">✦ {astrocoins}</span>
        </p>
      )}
      <ul className="profile-tarot-shop-grid">
        {shopItems.map((item) => {
          const busy = busyId === item.id;
          const previewSrc = localTarotBackImageUrl(item.id) ?? item.imageUrl;
          const showPreview = Boolean(previewSrc);
          return (
            <li key={item.id} className="profile-tarot-shop-card">
              <div className="profile-tarot-shop-preview" aria-hidden={!showPreview}>
                {showPreview ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="profile-tarot-shop-preview-img"
                    loading="lazy"
                    onError={(e) => {
                      const fallback = localTarotBackImageUrl(item.id);
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                ) : (
                  <div className="profile-tarot-shop-preview-fallback" />
                )}
              </div>
              <div className="profile-tarot-shop-card-body">
                <h3 className="profile-tarot-shop-card-name">{item.name}</h3>
                <p className="profile-tarot-shop-card-meta">
                  {item.owned ? (
                    <span className="profile-tarot-shop-owned">В коллекции</span>
                  ) : item.priceCrystals <= 0 ? (
                    <span className="profile-tarot-shop-owned">Бесплатно</span>
                  ) : (
                    <span className="profile-tarot-shop-price">✦ {item.priceCrystals}</span>
                  )}
                </p>
                <div className="profile-tarot-shop-actions">
                  {item.equipped ? (
                    <span className="profile-tarot-shop-badge">Надета</span>
                  ) : item.owned ? (
                    <button
                      type="button"
                      className="btn-primary profile-tarot-shop-btn"
                      disabled={busy}
                      onClick={() => void onEquip(item.id)}
                    >
                      {busy ? '…' : 'Надеть'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary profile-tarot-shop-btn"
                      disabled={busy || (item.priceCrystals > 0 && !token)}
                      onClick={() => void onBuy(item.id)}
                    >
                      {busy ? '…' : item.priceCrystals <= 0 ? 'Получить' : 'Купить'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {notice ? (
        <p className="profile-tarot-shop-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}