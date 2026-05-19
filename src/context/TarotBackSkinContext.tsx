import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { equipObject, shopBuy, tarotBackShopList, type TarotBackShopItem } from '../api/mysticApi';
import {
  DEFAULT_LOCAL_TAROT_BACK_ID,
  isLegacyTarotBackExcluded,
  isLocalTarotBackId,
  markLocalTarotBackOwned,
  mergeTarotBackShopItems,
  readLocalEquippedId,
  resolveTarotBackImageUrl,
  sanitizeLocalTarotBackStorage,
  writeLocalEquippedId,
} from '../features/tarot/tarotBackCatalog';
import { useSession } from './SessionContext';

type TarotBackSkinValue = {
  cardBackSrc: string;
  shopItems: TarotBackShopItem[];
  shopLoading: boolean;
  refreshTarotBackShop: () => Promise<void>;
  markShopItemOwned: (itemId: number) => void;
  equipTarotBack: (itemId: number) => Promise<'ok' | 'not_owned' | 'error'>;
  buyTarotBack: (itemId: number) => Promise<'ok' | 'already_bought' | 'not_enough' | 'error'>;
};

const TarotBackSkinContext = createContext<TarotBackSkinValue | null>(null);

export function TarotBackSkinProvider({ children }: { children: ReactNode }) {
  const {
    token,
    backendEnabled,
    equippedTarotBackgroundId,
    setEquippedTarotBackgroundId,
    astrocoins,
    applyAstrocoinsFromResponse,
  } = useSession();
  const [shopItems, setShopItems] = useState<TarotBackShopItem[]>(() =>
    mergeTarotBackShopItems([], readLocalEquippedId(), equippedTarotBackgroundId),
  );
  const [shopLoading, setShopLoading] = useState(false);
  const [localEquippedId, setLocalEquippedId] = useState<number | null>(() => readLocalEquippedId());

  const loadShop = useCallback(async () => {
    sanitizeLocalTarotBackStorage();
    let localEq = readLocalEquippedId();
    setLocalEquippedId(localEq);

    let apiItems: TarotBackShopItem[] = [];
    if (token && backendEnabled) {
      setShopLoading(true);
      try {
        apiItems = await tarotBackShopList(token, equippedTarotBackgroundId);
      } catch {
        apiItems = [];
      } finally {
        setShopLoading(false);
      }
    }

    let apiEquippedHint = equippedTarotBackgroundId;
    if (
      apiEquippedHint != null &&
      apiEquippedHint > 0 &&
      apiItems.some((i) => i.id === apiEquippedHint && isLegacyTarotBackExcluded(i))
    ) {
      setEquippedTarotBackgroundId(null);
      writeLocalEquippedId(DEFAULT_LOCAL_TAROT_BACK_ID);
      localEq = DEFAULT_LOCAL_TAROT_BACK_ID;
      setLocalEquippedId(DEFAULT_LOCAL_TAROT_BACK_ID);
      apiEquippedHint = null;
    }

    const merged = mergeTarotBackShopItems(apiItems, localEq, apiEquippedHint);
    setShopItems(merged);

    if (!localEq && !apiEquippedHint) {
      writeLocalEquippedId(DEFAULT_LOCAL_TAROT_BACK_ID);
      setLocalEquippedId(DEFAULT_LOCAL_TAROT_BACK_ID);
      setShopItems(mergeTarotBackShopItems(apiItems, DEFAULT_LOCAL_TAROT_BACK_ID, null));
    }
  }, [token, backendEnabled, equippedTarotBackgroundId, setEquippedTarotBackgroundId]);

  const markShopItemOwned = useCallback((itemId: number) => {
    if (isLocalTarotBackId(itemId)) {
      markLocalTarotBackOwned(itemId);
    }
    setShopItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, owned: true } : it)));
  }, []);

  const equipTarotBack = useCallback(
    async (itemId: number): Promise<'ok' | 'not_owned' | 'error'> => {
      const row = shopItems.find((i) => i.id === itemId);
      if (!row?.owned) return 'not_owned';

      if (isLocalTarotBackId(itemId)) {
        writeLocalEquippedId(itemId);
        setLocalEquippedId(itemId);
        setEquippedTarotBackgroundId(null);
        await loadShop();
        return 'ok';
      }

      if (!token) return 'error';
      try {
        const s = await equipObject({ item_id: itemId }, token);
        if (s === 'ok') {
          writeLocalEquippedId(null);
          setLocalEquippedId(null);
          setEquippedTarotBackgroundId(itemId);
          await loadShop();
          return 'ok';
        }
        if (s === 'not_owned') return 'not_owned';
        return 'error';
      } catch {
        return 'error';
      }
    },
    [shopItems, token, setEquippedTarotBackgroundId, loadShop],
  );

  const buyTarotBack = useCallback(
    async (itemId: number): Promise<'ok' | 'already_bought' | 'not_enough' | 'error'> => {
      const row = shopItems.find((i) => i.id === itemId);
      if (!row) return 'error';
      if (row.owned) return 'already_bought';

      if (isLocalTarotBackId(itemId)) {
        const price = row.priceCrystals;
        if (astrocoins !== null && price > astrocoins) return 'not_enough';
        markLocalTarotBackOwned(itemId);
        markShopItemOwned(itemId);
        if (price > 0 && astrocoins !== null) {
          applyAstrocoinsFromResponse({ score_crystal: astrocoins - price });
        }
        return 'ok';
      }

      if (!token) return 'error';
      try {
        const raw = await shopBuy({ itemId }, token);
        applyAstrocoinsFromResponse(raw);
        const status = (raw as { status?: string }).status;
        if (status === 'ok' || status === 'already_bought') {
          markShopItemOwned(itemId);
          await loadShop();
          return status === 'already_bought' ? 'already_bought' : 'ok';
        }
        if (status === 'not_enough_crystals' || status === 'not_enough_points') return 'not_enough';
        return 'error';
      } catch {
        return 'error';
      }
    },
    [shopItems, astrocoins, markShopItemOwned, applyAstrocoinsFromResponse, token, loadShop],
  );

  useEffect(() => {
    sanitizeLocalTarotBackStorage();
    void loadShop();
  }, [loadShop]);

  useEffect(() => {
    if (equippedTarotBackgroundId && isLocalTarotBackId(equippedTarotBackgroundId)) {
      setEquippedTarotBackgroundId(null);
    }
  }, [equippedTarotBackgroundId, setEquippedTarotBackgroundId]);

  const cardBackSrc = useMemo(
    () => resolveTarotBackImageUrl(shopItems, equippedTarotBackgroundId, localEquippedId),
    [shopItems, equippedTarotBackgroundId, localEquippedId],
  );

  const value = useMemo(
    () => ({
      cardBackSrc,
      shopItems,
      shopLoading,
      refreshTarotBackShop: loadShop,
      markShopItemOwned,
      equipTarotBack,
      buyTarotBack,
    }),
    [cardBackSrc, shopItems, shopLoading, loadShop, markShopItemOwned, equipTarotBack, buyTarotBack],
  );

  return <TarotBackSkinContext.Provider value={value}>{children}</TarotBackSkinContext.Provider>;
}

export function useTarotBackSkin() {
  const v = useContext(TarotBackSkinContext);
  if (!v) throw new Error('useTarotBackSkin outside TarotBackSkinProvider');
  return v;
}
