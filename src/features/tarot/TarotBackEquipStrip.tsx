import { useCallback, useState } from 'react';
import { useTarotBackSkin } from '../../context/TarotBackSkinContext';
import { localTarotBackImageUrl } from './tarotBackCatalog';

/**
 * Telegram: без витрины покупки — только смена уже доступных рубашек.
 */
export function TarotBackEquipStrip() {
  const { shopItems, shopLoading, equipTarotBack } = useTarotBackSkin();
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const owned = shopItems.filter((i) => i.owned);

  const onEquip = useCallback(
    async (itemId: number) => {
      setNotice(null);
      setBusyId(itemId);
      try {
        const s = await equipTarotBack(itemId);
        if (s === 'ok') setNotice('Рубашка применена в Таро и карте дня.');
        else setNotice('Не удалось сменить рубашку.');
      } finally {
        setBusyId(null);
      }
    },
    [equipTarotBack],
  );

  if (shopLoading && owned.length === 0) {
    return (
      <section className="profile-tarot-equip" aria-labelledby="profile-tarot-equip-heading">
        <h2 id="profile-tarot-equip-heading" className="profile-tarot-equip-title">
          Рубашка Таро
        </h2>
        <p className="profile-tarot-equip-lead">Загружаем…</p>
      </section>
    );
  }

  if (owned.length === 0) return null;

  return (
    <section className="profile-tarot-equip" aria-labelledby="profile-tarot-equip-heading">
      <h2 id="profile-tarot-equip-heading" className="profile-tarot-equip-title">
        Рубашка Таро
      </h2>
      <p className="profile-tarot-equip-lead">
        Выберите рубашку для раскладов. Покупка новых обложек — в приложении VK.
      </p>
      <ul className="profile-tarot-equip-list" role="list">
        {owned.map((item) => {
          const preview = localTarotBackImageUrl(item.id) ?? item.imageUrl;
          const busy = busyId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={
                  'profile-tarot-equip-item' + (item.equipped ? ' profile-tarot-equip-item--active' : '')
                }
                disabled={busy || item.equipped}
                onClick={() => void onEquip(item.id)}
                aria-pressed={item.equipped}
                aria-label={item.equipped ? `${item.name}, надета` : `Надеть ${item.name}`}
              >
                {preview ? (
                  <img src={preview} alt="" className="profile-tarot-equip-thumb" loading="lazy" />
                ) : (
                  <span className="profile-tarot-equip-thumb profile-tarot-equip-thumb--empty" aria-hidden />
                )}
                <span className="profile-tarot-equip-name">{item.name}</span>
                {item.equipped ? <span className="profile-tarot-equip-tag">Надета</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {notice ? (
        <p className="profile-tarot-equip-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
