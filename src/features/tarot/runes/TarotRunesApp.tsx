import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { isBackendEnabled } from '../../../api/config';
import {
  profileGet,
  tarotCheck,
  tarotGenerate,
  tarotGenerateFollow,
  tarotGenerateFollowPay,
  tarotGeneratePay,
  tarotOpen,
} from '../../../api/mysticApi';
import { useSession } from '../../../context/SessionContext';
import { useTarotBackSkin } from '../../../context/TarotBackSkinContext';
import { pickWalletAstrocoinBalance } from '../../../lib/astrocoinsBalance';
import {
  appendFollowupToHistory,
  loadHistory,
  loadLastReading,
  prependHistory,
  removeHistoryItem,
  saveLastReading,
  type TarotFollowupRecord,
} from '../../../lib/tarotLocalStore';
import { getCardById, getCardByName, parseSpreadKey, type DrawnTarotCard } from './cards';
import { SPREADS, type SpreadId } from './constants';
import './TarotRunes.css';

type OpenData = { need_payment: boolean; key: string; crystal?: number; coin?: number };

type FollowItem = {
  question: string;
  interpretation: string;
  card_name?: string;
  card_id?: string | number;
  card?: DrawnTarotCard | null;
};

function normalizeInterpretResponse(res: Record<string, unknown>) {
  const interpretation = (res.interpretation ?? res.Interpretation) as string | undefined;
  const session_id = (res.session_id ?? res.SessionID) as number | undefined;
  return { ...res, interpretation, session_id };
}

function normalizeFollowResponse(res: Record<string, unknown>) {
  const card_name = (res.card_name ?? res.cardcard_name_id) as string | undefined;
  return { ...res, card_name };
}

function readFollowFreeLeft(res: Record<string, unknown>): number | undefined {
  for (const key of ['free_left', 'freeLeft', 'follow_free_left', 'followups_left', 'free_follow_left']) {
    const v = res[key];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
    if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Math.max(0, Number(v.trim()));
  }
  return undefined;
}

function formatFollowupFreeHint(remaining: number | null, followupsDone: number): string {
  const slotsLeft = Math.max(0, 2 - followupsDone);
  if (remaining !== null) {
    if (remaining <= 0) return 'Бесплатных уточнений нет — дальше за ✦.';
    if (remaining === 1) return 'Осталось 1 бесплатное уточнение.';
    return `Осталось ${remaining} бесплатных уточнений.`;
  }
  if (slotsLeft > 0) {
    return `До ${slotsLeft} уточнений бесплатно.`;
  }
  return '';
}

function formatInterpretation(text: string): ReactNode {
  if (!text) return '';
  const cardListPattern = /^(Карты в раскладе:|Карты:|В раскладе:|Расклад:)\s*(.+?)(?:\.|$)/i;
  const match = text.match(cardListPattern);
  if (match) {
    const cardListEnd = match.index! + match[0].length;
    const cardListText = match[0].trim();
    let descriptionStart = cardListEnd;
    while (
      descriptionStart < text.length &&
      (text[descriptionStart] === ' ' || text[descriptionStart] === '\n' || text[descriptionStart] === '.')
    ) {
      descriptionStart++;
    }
    const descriptionText = text.slice(descriptionStart).trim();
    if (descriptionText) {
      return (
        <>
          <div style={{ marginBottom: 16 }}>{cardListText}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{descriptionText}</div>
        </>
      );
    }
    return <div>{cardListText}</div>;
  }
  return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
}

function mapServerCardEntry(cardData: unknown): DrawnTarotCard | null {
  if (typeof cardData === 'number') {
    const c = getCardById(cardData);
    return c ? { ...c, reversed: false } : null;
  }
  if (typeof cardData === 'string') {
    const rev = cardData.endsWith('*');
    const clean = rev ? cardData.slice(0, -1) : cardData;
    const id = parseInt(clean, 10);
    if (!Number.isNaN(id)) {
      const c = getCardById(id);
      return c ? { ...c, reversed: rev } : null;
    }
    const c = getCardByName(clean);
    return c ? { ...c, reversed: false } : null;
  }
  if (cardData && typeof cardData === 'object') {
    const o = cardData as Record<string, unknown>;
    if (o.id !== undefined) {
      const idStr = String(o.id);
      let rev = idStr.endsWith('*');
      const cardId = rev ? parseInt(idStr.slice(0, -1), 10) : typeof o.id === 'number' ? o.id : parseInt(idStr, 10);
      const c = getCardById(cardId);
      if (o.reversed !== undefined) rev = Boolean(o.reversed);
      return c ? { ...c, reversed: rev } : null;
    }
    if (typeof o.name === 'string') {
      const c = getCardByName(o.name);
      return c ? { ...c, reversed: Boolean(o.reversed) } : null;
    }
  }
  return null;
}

export type TarotRunesAppProps = {
  /** Возврат на экран «Карта дня» (из мини-расклада на главной вкладке таро). */
  onBackToDayCard?: () => void;
  /** Сразу выбрать тип расклада (например, из модалки на главной). */
  initialSpreadId?: SpreadId;
};

export function TarotRunesApp({ onBackToDayCard, initialSpreadId }: TarotRunesAppProps = {}) {
  const navigate = useNavigate();
  const { token, applyAstrocoinsFromResponse, astrocoins } = useSession();
  const { cardBackSrc } = useTarotBackSkin();
  const useLocal = !isBackendEnabled() || !token;
  const apiGenOnceRef = useRef(false);
  const historyWrittenForKeyRef = useRef<string | null>(null);

  const [isChecking, setIsChecking] = useState(!useLocal);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [limitTotal, setLimitTotal] = useState<number | null>(null);
  const [prLim] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [selectedSpreadId, setSelectedSpreadId] = useState<SpreadId | null>(null);
  const [question, setQuestion] = useState('');

  const [isOpening, setIsOpening] = useState(false);
  const [openData, setOpenData] = useState<OpenData | null>(null);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([]);
  const [drawnCards, setDrawnCards] = useState<DrawnTarotCard[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followups, setFollowups] = useState<FollowItem[]>([]);
  const [isFollowupLoading, setIsFollowupLoading] = useState(false);
  const [followupPaymentOffer, setFollowupPaymentOffer] = useState<{
    crystal?: number;
    monet?: number;
    free_left?: number;
  } | null>(null);
  /** Остаток бесплатных уточнений по ответу API; null — показываем общую подсказку. */
  const [followupFreeRemaining, setFollowupFreeRemaining] = useState<number | null>(null);
  const [payShortage, setPayShortage] = useState<{ balance: number; need: number } | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'main' | 'followup'>('main');
  const [showCardsView, setShowCardsView] = useState(false);

  const [storageRev, setStorageRev] = useState(0);
  const lastReading = useMemo(() => loadLastReading(), [storageRev]);
  const history = useMemo(() => loadHistory(), [storageRev]);

  const selectedSpread = useMemo(
    () => SPREADS.find((s) => s.id === selectedSpreadId) ?? null,
    [selectedSpreadId],
  );
  const cardsCount = selectedSpread ? selectedSpread.cards : 0;
  const allCardsFlipped = cardsCount > 0 && flippedCards.filter(Boolean).length === cardsCount;
  const showMainGenOverlay = isGenerating && !interpretation;
  const showFollowupBusyOverlay = isFollowupLoading;

  const canMakeSpread = !!selectedSpread && question.trim().length > 3;
  const hasFreeAttempts = attemptsLeft === null ? true : attemptsLeft > 0;

  const followupFreeHint = useMemo(
    () => formatFollowupFreeHint(followupFreeRemaining, followups.length),
    [followupFreeRemaining, followups.length],
  );

  const closePaymentModal = useCallback(() => {
    setPayShortage(null);
    setShowPaymentModal(false);
  }, []);

  const goProfileTopup = useCallback(() => {
    setPayShortage(null);
    setShowPaymentModal(false);
    navigate('/?panel=profile');
  }, [navigate]);

  const formatAttemptsLabel = () => {
    if (attemptsLeft === null || limitTotal === null) return '';
    if (attemptsLeft === 1) return 'Осталась 1 бесплатная попытка.';
    if (attemptsLeft >= 2 && attemptsLeft <= 4) return `Осталось ${attemptsLeft} бесплатных попытки.`;
    return `Осталось ${attemptsLeft} бесплатных попыток.`;
  };

  const resetSpread = useCallback(() => {
    apiGenOnceRef.current = false;
    historyWrittenForKeyRef.current = null;
    setShowCardsView(false);
    setOpenData(null);
    setInterpretation(null);
    setSessionId(null);
    setFollowups([]);
    setFollowupPaymentOffer(null);
    setFollowupFreeRemaining(null);
    setPayShortage(null);
    setFollowupQuestion('');
    setFlippedCards([]);
    setDrawnCards([]);
    setError('');
    setQuestion('');
    setSelectedSpreadId(null);
    setShowPaymentModal(false);
  }, []);

  const fetchCheck = useCallback(async () => {
    if (useLocal) {
      setIsChecking(false);
      setAttemptsLeft(null);
      setLimitTotal(null);
      return;
    }
    setIsChecking(true);
    setError('');
    try {
      const res = (await tarotCheck(token!)) as Record<string, unknown>;
      const limitTotal = Number(res.limit_total ?? res.limitTotal);
      const quotaLeft = Number(res.quota_left ?? res.quotaLeft);
      if (Number.isFinite(limitTotal) && Number.isFinite(quotaLeft)) {
        setLimitTotal(limitTotal);
        setAttemptsLeft(quotaLeft);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setAttemptsLeft(null);
        setLimitTotal(null);
      } else {
        console.error('[Tarot] /tarot/check', e);
        setAttemptsLeft(null);
        setLimitTotal(null);
      }
    } finally {
      setIsChecking(false);
    }
  }, [token, useLocal]);

  const refreshWalletFromProfile = useCallback(async () => {
    if (!token || useLocal) return;
    try {
      const p = await profileGet(token);
      applyAstrocoinsFromResponse(p);
    } catch {
      /* баланс подтянется при следующем открытии профиля или VK init */
    }
  }, [token, useLocal, applyAstrocoinsFromResponse]);

  useEffect(() => {
    void fetchCheck();
  }, [fetchCheck]);

  useEffect(() => {
    if (!initialSpreadId) return;
    setSelectedSpreadId(initialSpreadId);
  }, [initialSpreadId]);

  useEffect(() => {
    if (!interpretation || !String(interpretation).trim() || !allCardsFlipped || !selectedSpread) return;
    const dedupeKey = `${sessionId ?? 'n'}:${selectedSpread.id}:${String(interpretation).slice(0, 120)}`;
    if (historyWrittenForKeyRef.current === dedupeKey) return;
    historyWrittenForKeyRef.current = dedupeKey;
    const fullText = String(interpretation);
    saveLastReading({
      spreadId: selectedSpread.id,
      spreadLabel: selectedSpread.name,
      question: question.trim(),
      interpretation: fullText,
    });
    prependHistory({
      sessionId: sessionId ?? undefined,
      spreadId: selectedSpread.id,
      spreadLabel: selectedSpread.name,
      question: question.trim(),
      interpretation: fullText,
      followups: [],
    });
    setStorageRev((r) => r + 1);
  }, [interpretation, allCardsFlipped, selectedSpread, question, sessionId]);

  const persistFollowupToHistory = useCallback(
    (item: TarotFollowupRecord) => {
      if (!sessionId) return;
      const ok = appendFollowupToHistory(sessionId, item);
      if (ok) setStorageRev((r) => r + 1);
    },
    [sessionId],
  );

  const handleOpenSpread = async () => {
    if (!selectedSpread) return;
    apiGenOnceRef.current = false;
    setIsOpening(true);
    setError('');
    setInterpretation(null);
    setSessionId(null);
    setFollowups([]);
    setFollowupPaymentOffer(null);
    setFollowupFreeRemaining(null);
    setPayShortage(null);

    if (useLocal) {
      setError('Для расклада нужна авторизация и доступ к серверу.');
      setIsOpening(false);
      return;
    }

    try {
      const res = await tarotOpen({ type: selectedSpread.type }, token!);
      if (!res?.key) throw new Error('bad_open_response');
      const keyString = String(res.key);
      const needsPayment = Boolean(res.need_payment);
      setOpenData({
        need_payment: needsPayment,
        key: keyString,
        crystal: typeof res.crystal === 'number' ? res.crystal : undefined,
        coin: typeof res.coin === 'number' ? res.coin : undefined,
      });
      setFlippedCards(new Array(cardsCount).fill(false));
      setDrawnCards(parseSpreadKey(keyString));
      if (needsPayment) {
        setPaymentMode('main');
        setPayShortage(null);
        setShowPaymentModal(true);
      } else {
        setShowCardsView(true);
        if (hasFreeAttempts && attemptsLeft !== null) {
          setAttemptsLeft((p) => (p != null && p > 0 ? p - 1 : p));
        }
      }
    } catch (e) {
      console.error('[Tarot] /tarot/open', e);
      setError('Не удалось открыть расклад. Попробуйте ещё раз.');
    } finally {
      setIsOpening(false);
    }
  };

  const toggleCard = (index: number) => {
    if (!openData || index < 0 || index >= cardsCount) return;
    setFlippedCards((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const applyInterpretResponse = (res: Record<string, unknown>) => {
    const norm = normalizeInterpretResponse(res) as Record<string, unknown>;
    if (Array.isArray(norm.cards)) {
      const cards = (norm.cards as unknown[]).map(mapServerCardEntry).filter((x): x is DrawnTarotCard => x != null);
      if (cards.length) setDrawnCards(cards);
    }
    if (typeof norm.interpretation === 'string') setInterpretation(norm.interpretation);
    if (typeof norm.session_id === 'number') setSessionId(norm.session_id);
  };

  const doGenerate = async () => {
    if (!openData || !selectedSpread || !token) return;
    if (!openData.key) {
      setError('Нет ключа расклада.');
      return;
    }
    if (question.trim().length < 4) {
      setError('Вопрос должен содержать минимум 4 символа.');
      return;
    }
    setIsGenerating(true);
    setError('');
    try {
      const body = {
        type: selectedSpread.type || 'classic',
        key: openData.key,
        question: question.trim(),
      };
      const res = await tarotGenerate(body, token);
      applyInterpretResponse(res as Record<string, unknown>);
      applyAstrocoinsFromResponse(res);
    } catch (e) {
      console.error('[Tarot] /tarot/generate', e);
      apiGenOnceRef.current = false;
      setError('Не удалось получить ответ. Попробуйте ещё раз.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (
      !useLocal &&
      allCardsFlipped &&
      openData &&
      selectedSpread &&
      !openData.need_payment &&
      !interpretation &&
      !isGenerating &&
      token
    ) {
      if (apiGenOnceRef.current) return;
      apiGenOnceRef.current = true;
      void doGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCardsFlipped, openData, selectedSpread, interpretation, isGenerating, useLocal, question, drawnCards, token]);

  const handlePayAndGenerate = async (_payCurrency: 'coin' | 'crystal') => {
    if (!openData || !selectedSpread || !token) return;
    setError('');
    setPayShortage(null);
    if (
      _payCurrency === 'crystal' &&
      typeof openData.crystal === 'number' &&
      typeof astrocoins === 'number' &&
      astrocoins < openData.crystal
    ) {
      setPayShortage({ balance: astrocoins, need: openData.crystal });
      return;
    }
    setIsGenerating(true);
    try {
      const paidBody = {
        type: selectedSpread.type || 'classic',
        key: openData.key,
        question: question.trim(),
      };
      const res = await tarotGeneratePay(paidBody, token);
      applyInterpretResponse(res as Record<string, unknown>);
      applyAstrocoinsFromResponse(res);
      await refreshWalletFromProfile();
      setShowPaymentModal(false);
      setShowCardsView(true);
    } catch (e) {
      console.error('[Tarot] interpret pay', e);
      let bal: number | null = typeof astrocoins === 'number' ? astrocoins : null;
      const need = openData.crystal;
      try {
        const p = await profileGet(token);
        applyAstrocoinsFromResponse(p);
        const w = pickWalletAstrocoinBalance(p);
        if (typeof w === 'number') bal = w;
      } catch {
        /* оставляем последний известный bal */
      }
      if (_payCurrency === 'crystal' && typeof need === 'number' && bal !== null && bal < need) {
        setPayShortage({ balance: bal, need });
      } else {
        setError('Не удалось оплатить расклад.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFollowup = async () => {
    if (!sessionId || !followupQuestion.trim() || !token || useLocal) return;
    setIsFollowupLoading(true);
    setError('');
    try {
      const body = { sessionId, question: followupQuestion.trim() };
      const res = normalizeFollowResponse(
        (await tarotGenerateFollow(body, token)) as Record<string, unknown>,
      ) as Record<string, unknown>;

      if (res?.pay) {
        const fl = readFollowFreeLeft(res);
        if (fl !== undefined) setFollowupFreeRemaining(fl);
        setFollowupPaymentOffer({
          crystal: typeof res.crystal === 'number' ? res.crystal : undefined,
          monet: typeof res.monet === 'number' ? res.monet : undefined,
          free_left: typeof res.free_left === 'number' ? res.free_left : fl,
        });
        setPaymentMode('followup');
        setPayShortage(null);
        setShowPaymentModal(true);
        return;
      }

      if (typeof res.interpretation === 'string') {
        let card: DrawnTarotCard | null = null;
        if (res.card_id !== undefined && res.card_id !== null) {
          const idStr = String(res.card_id);
          const rev = idStr.endsWith('*');
          const cardId = rev ? parseInt(idStr.slice(0, -1), 10) : Number(res.card_id);
          const c = getCardById(cardId);
          if (c) card = { ...c, reversed: rev };
        } else if (typeof res.card_name === 'string') {
          const c = getCardByName(res.card_name);
          if (c) card = { ...c, reversed: false };
        }
        const followItem = {
          question: followupQuestion.trim(),
          interpretation: res.interpretation as string,
          card_name: res.card_name as string | undefined,
          card_id: res.card_id as string | number | undefined,
          card,
        };
        setFollowups((prev) => [...prev, followItem]);
        persistFollowupToHistory({
          question: followItem.question,
          interpretation: followItem.interpretation,
        });
        setFollowupQuestion('');
        applyAstrocoinsFromResponse(res);
        const fl = readFollowFreeLeft(res);
        if (fl !== undefined) setFollowupFreeRemaining(fl);
      }
    } catch (e) {
      console.error('[Tarot] follow', e);
      setError('Не удалось получить дополнительный ответ.');
    } finally {
      setIsFollowupLoading(false);
    }
  };

  const handleFollowupPay = async (_currency: 'coin' | 'crystal') => {
    if (!sessionId || !followupQuestion.trim() || !token) return;
    setError('');
    setPayShortage(null);
    const crystalNeed = followupPaymentOffer?.crystal;
    if (
      _currency === 'crystal' &&
      typeof crystalNeed === 'number' &&
      typeof astrocoins === 'number' &&
      astrocoins < crystalNeed
    ) {
      setPayShortage({ balance: astrocoins, need: crystalNeed });
      return;
    }
    setIsFollowupLoading(true);
    try {
      const body = { sessionId, question: followupQuestion.trim() };
      const res = normalizeFollowResponse(
        (await tarotGenerateFollowPay(body, token)) as Record<string, unknown>,
      ) as Record<string, unknown>;
      if (typeof res.interpretation === 'string') {
        let card: DrawnTarotCard | null = null;
        if (res.card_id !== undefined && res.card_id !== null) {
          const idStr = String(res.card_id);
          const rev = idStr.endsWith('*');
          const cardId = rev ? parseInt(idStr.slice(0, -1), 10) : Number(res.card_id);
          const c = getCardById(cardId);
          if (c) card = { ...c, reversed: rev };
        } else if (typeof res.card_name === 'string') {
          const c = getCardByName(res.card_name);
          if (c) card = { ...c, reversed: false };
        }
        const followItem = {
          question: followupQuestion.trim(),
          interpretation: res.interpretation as string,
          card_name: res.card_name as string | undefined,
          card_id: res.card_id as string | number | undefined,
          card,
        };
        setFollowups((prev) => [...prev, followItem]);
        persistFollowupToHistory({
          question: followItem.question,
          interpretation: followItem.interpretation,
        });
        setFollowupQuestion('');
      }
      applyAstrocoinsFromResponse(res);
      await refreshWalletFromProfile();
      setShowPaymentModal(false);
      setFollowupPaymentOffer(null);
      const flAfterPay = readFollowFreeLeft(res);
      if (flAfterPay !== undefined) setFollowupFreeRemaining(flAfterPay);
    } catch (e) {
      console.error('[Tarot] follow pay', e);
      let bal: number | null = typeof astrocoins === 'number' ? astrocoins : null;
      const need = followupPaymentOffer?.crystal;
      try {
        const p = await profileGet(token);
        applyAstrocoinsFromResponse(p);
        const w = pickWalletAstrocoinBalance(p);
        if (typeof w === 'number') bal = w;
      } catch {
        /* */
      }
      if (_currency === 'crystal' && typeof need === 'number' && bal !== null && bal < need) {
        setPayShortage({ balance: bal, need });
      } else {
        setError('Не удалось оплатить уточнение.');
      }
    } finally {
      setIsFollowupLoading(false);
    }
  };

  const layoutClass =
    selectedSpread?.id === 'cross'
      ? 'cross-layout'
      : selectedSpread?.id === 'pentagram'
        ? 'road-layout'
        : selectedSpread?.id === 'relationship'
          ? 'railstat-layout'
          : '';

  const paymentCrystal =
    paymentMode === 'main' ? openData?.crystal : followupPaymentOffer?.crystal;
  const paymentCoin = paymentMode === 'main' ? openData?.coin : followupPaymentOffer?.monet;

  const renderPaymentPortal = () => {
    if (!showPaymentModal || !openData || typeof document === 'undefined') return null;
    return createPortal(
      <div className="dream-pay-modal-backdrop" onClick={closePaymentModal}>
        <div className="dream-pay-modal" onClick={(e) => e.stopPropagation()}>
          <h3>
            {payShortage
              ? 'Недостаточно астрокоинов'
              : paymentMode === 'main'
                ? 'Расшифровать за астрокоины или монеты'
                : 'Платный уточняющий вопрос'}
          </h3>
          {(isGenerating || isFollowupLoading) && (
            <div className="dream-pay-loading" role="status">
              Загрузка…
            </div>
          )}
          {!payShortage && (
            <p>
              {paymentMode === 'main'
                ? 'Лимит исчерпан. Продолжить за ✦ — сумма на кнопке.'
                : 'Уточнение за ✦ — сумма на кнопке.'}
            </p>
          )}
          {payShortage && (
            <div className="dream-pay-shortage">
              <p>
                Сейчас на счёте: <strong className="dream-pay-shortage-strong">✦ {payShortage.balance}</strong>
              </p>
              <p>
                Нужно для оплаты: <strong className="dream-pay-shortage-strong">✦ {payShortage.need}</strong>
              </p>
              <p>
                Не хватает:{' '}
                <strong className="dream-pay-shortage-strong">✦ {Math.max(0, payShortage.need - payShortage.balance)}</strong>
              </p>
              <div className="dream-pay-shortage-actions">
                <button type="button" className="dream-pay-button dream-pay-button--primary" onClick={goProfileTopup}>
                  Пополнить астрокоины
                </button>
                <button type="button" className="btn-ghost dream-pay-cancel dream-pay-shortage-exit" onClick={closePaymentModal}>
                  Закрыть без оплаты
                </button>
              </div>
            </div>
          )}
          {!payShortage && (
            <div className="dream-pay-options">
              {typeof paymentCrystal === 'number' && (
                <button
                  type="button"
                  className="dream-pay-button"
                  onClick={() =>
                    paymentMode === 'main' ? void handlePayAndGenerate('crystal') : void handleFollowupPay('crystal')
                  }
                  disabled={isGenerating || isFollowupLoading}
                >
                  <span className="dream-pay-astro-icon" aria-hidden>
                    ✦
                  </span>
                  Оплатить {paymentCrystal} астрокоинов
                </button>
              )}
              {typeof paymentCoin === 'number' && (
                <button
                  type="button"
                  className="dream-pay-button"
                  onClick={() =>
                    paymentMode === 'main' ? void handlePayAndGenerate('coin') : void handleFollowupPay('coin')
                  }
                  disabled={isGenerating || isFollowupLoading}
                >
                  <img src="/icons/coin.png" alt="" width={28} height={28} />
                  Оплатить {paymentCoin} монет
                </button>
              )}
            </div>
          )}
          {!payShortage && (
            <button type="button" className="btn-ghost dream-pay-cancel" onClick={closePaymentModal}>
              Отменить
            </button>
          )}
          {error && !payShortage && <div className="dream-error">{error}</div>}
        </div>
      </div>,
      document.body,
    );
  };

  if (!showCardsView) {
    return (
      <div className="tarot-runest-root">
        <div className="product-page">
          <section className="product-hero product-hero--tarot tarot-setup-hero">
            {onBackToDayCard ? (
              <div className="tarot-back-to-day-row">
                <button type="button" className="tarot-back-to-day-btn" onClick={onBackToDayCard}>
                  <span className="tarot-back-to-day-icon" aria-hidden>
                    ←
                  </span>
                  К карте дня
                </button>
              </div>
            ) : null}
            <div className="tarot-setup-visual" aria-hidden="true">
              <div className="tarot-deck-fan">
                <img src={cardBackSrc} alt="" className="tarot-deck-fan-card tarot-deck-fan-card--left" />
                <img src={cardBackSrc} alt="" className="tarot-deck-fan-card tarot-deck-fan-card--mid" />
                <img src={cardBackSrc} alt="" className="tarot-deck-fan-card tarot-deck-fan-card--right" />
              </div>
              <div className="tarot-setup-sparkles">
                <span className="tarot-sparkle" />
                <span className="tarot-sparkle" />
                <span className="tarot-sparkle" />
                <span className="tarot-sparkle" />
              </div>
            </div>
            <h1 className="tarot-setup-heading">Таро</h1>
            <p className="tarot-setup-tagline">Расклад → вопрос → карты.</p>
            {(history.length > 0 || lastReading) && (
              <div className="tarot-saved-panel">
                <h3>История раскладов</h3>
                {history.length > 0 ? (
                  <ul className="tarot-history-feed" aria-label="История раскладов">
                    {history.map((h) => (
                      <li key={h.id} className="tarot-history-feed-item">
                        <div className="tarot-history-feed-head">
                          <div>
                            <strong className="tarot-history-feed-title">{h.spreadLabel}</strong>
                            <time className="tarot-history-feed-date" dateTime={new Date(h.savedAt).toISOString()}>
                              {new Intl.DateTimeFormat('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(h.savedAt)}
                            </time>
                          </div>
                          <button
                            type="button"
                            className="tarot-fav-remove"
                            onClick={() => {
                              removeHistoryItem(h.id);
                              setStorageRev((r) => r + 1);
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                        {h.question ? <p className="tarot-history-feed-question">«{h.question}»</p> : null}
                        <p className="tarot-history-feed-text">{h.interpretation}</p>
                        {h.followups.length > 0 ? (
                          <div className="tarot-history-feed-followups">
                            {h.followups.map((f, idx) => (
                              <div key={idx} className="tarot-history-feed-followup">
                                <p className="tarot-history-feed-followup-q">Доп. вопрос: «{f.question}»</p>
                                <p className="tarot-history-feed-text">{f.interpretation}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  lastReading && (
                    <div className="tarot-history-feed-item">
                      <p className="tarot-history-feed-title">Последний расклад · {lastReading.spreadLabel}</p>
                      {lastReading.question ? (
                        <p className="tarot-history-feed-question">«{lastReading.question}»</p>
                      ) : null}
                      <p className="tarot-history-feed-text">{lastReading.interpretation}</p>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="tarot-content">
              {isChecking ? (
                <div className="tarot-loading">Загружаем доступные попытки…</div>
              ) : (
                <>
                  <div className="tarot-section-label">Тип расклада</div>
                  <div className="tarot-spreads-grid">
                    {SPREADS.map((spread) => (
                      <button
                        key={spread.id}
                        type="button"
                        className={'tarot-spread-btn' + (selectedSpreadId === spread.id ? ' selected' : '')}
                        onClick={() => setSelectedSpreadId(spread.id)}
                      >
                        <span className="tarot-spread-icon" aria-hidden>
                          {spread.icon}
                        </span>
                        <div className="tarot-spread-name">{spread.name}</div>
                        <div className="tarot-spread-hint">{spread.desc}</div>
                      </button>
                    ))}
                  </div>
                  {selectedSpread && (
                    <>
                      <div className="tarot-spread-description">
                        <div className="tarot-spread-description-title">{selectedSpread.name}</div>
                        <div className="tarot-spread-description-text">{selectedSpread.description}</div>
                      </div>
                      <div className="tarot-section-label">Ваш вопрос</div>
                      <textarea
                        className="tarot-question-input"
                        placeholder="Ваш вопрос (от 4 символов)"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                      <div className="tarot-attempts">
                        {!useLocal && attemptsLeft !== null && limitTotal !== null && (
                          <span className="tarot-attempts-free">{formatAttemptsLabel()} </span>
                        )}
                        <span className="tarot-attempts-premium">
                          {typeof prLim === 'number' ? `В премиуме до ${prLim} раскладов.` : 'В премиуме — больше раскладов.'}
                        </span>
                      </div>
                    </>
                  )}
                  {error && <div className="tarot-error">{error}</div>}
                </>
              )}
            </div>
            <div className="tarot-footer">
              {selectedSpread && (
                <button
                  type="button"
                  className="tarot-primary-btn"
                  onClick={() => void handleOpenSpread()}
                  disabled={!canMakeSpread || isOpening || isChecking}
                >
                  <span className="tarot-btn-text">{isOpening ? 'Готовим расклад…' : 'Сделать расклад'}</span>
                </button>
              )}
            </div>
          </section>
        </div>
        {renderPaymentPortal()}
        {isGenerating && !showCardsView ? (
          <div className="tarot-interpretation-loading-overlay">
            <div className="tarot-interpretation-loading">
              <div className="tarot-interpretation-loading-spinner" />
              <div className="tarot-interpretation-loading-text">Загрузка</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="tarot-runest-root">
      <div className="product-page">
        <section className="product-hero product-hero--tarot">
          <h1 className="tarot-setup-heading">Таро</h1>
          <p className="tarot-session-subtitle">{selectedSpread?.name ?? 'Расклад'}</p>
          <div className="tarot-content">
            {openData && (
              <>
                <div className="tarot-section-label">Ваш вопрос</div>
                <div className="tarot-question-readout">{question}</div>
                <div className="tarot-section-label">Карты расклада</div>
                <div className={`tarot-cards-grid ${layoutClass}`}>
                  {Array.from({ length: cardsCount }).map((_, idx) => {
                    const card = drawnCards[idx] ?? null;
                    const isFlipped = flippedCards[idx];
                    return (
                      <div key={idx} className="tarot-card-slot">
                        <button type="button" className={'tarot-card' + (isFlipped ? ' flipped' : '')} onClick={() => toggleCard(idx)}>
                          <div className="tarot-card-flipper">
                            <div className="tarot-card-face tarot-card-face--back" aria-hidden={isFlipped}>
                              <img src={cardBackSrc} alt="" className="tarot-card-back-face" />
                            </div>
                            <div className="tarot-card-face tarot-card-face--front">
                              {card?.image ? (
                                <img
                                  src={card.image}
                                  alt={card.name}
                                  className="tarot-card-face-img"
                                  style={{
                                    transform: card.reversed ? 'rotate(180deg)' : 'none',
                                    transformOrigin: 'center center',
                                  }}
                                />
                              ) : (
                                <div className="tarot-card-placeholder-face">{card ? card.name : `Карта ${idx + 1}`}</div>
                              )}
                            </div>
                          </div>
                        </button>
                        {isFlipped ? (
                          <div className="tarot-card-caption" aria-live="polite">
                            {card ? (
                              <>
                                <span className="tarot-card-caption-name">{card.name}</span>
                                {card.reversed ? <span className="tarot-card-caption-rev">перевёрнутая</span> : null}
                              </>
                            ) : (
                              <span className="tarot-card-caption-name">Карта {idx + 1}</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {showMainGenOverlay || showFollowupBusyOverlay ? (
                  <div className="tarot-interpretation-loading-overlay">
                    <div className="tarot-interpretation-loading">
                      <div className="tarot-interpretation-loading-spinner" />
                      <div className="tarot-interpretation-loading-text">
                        {showFollowupBusyOverlay ? 'Отвечаю на вопрос…' : 'Загрузка'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
            {interpretation && allCardsFlipped && (
              <div className="tarot-interpretation">
                <div className="tarot-interpretation-title">Толкование</div>
                <div>{formatInterpretation(interpretation)}</div>
              </div>
            )}
            {sessionId && allCardsFlipped && !useLocal && (
              <>
                {followups.length > 0 && (
                  <div className="tarot-followup-history">
                    {followups.map((f, idx) => (
                      <div key={idx} className="tarot-followup-item">
                        <div className="tarot-followup-q">Вопрос: {f.question}</div>
                        {f.card && f.card.image && (
                          <div className="tarot-followup-card-info">
                            <img
                              src={f.card.image}
                              alt={f.card.name}
                              className="tarot-followup-card-image"
                              style={{ transform: f.card.reversed ? 'rotate(180deg)' : 'none' }}
                            />
                            {f.card_name && <span className="tarot-followup-card-name">{f.card_name}</span>}
                          </div>
                        )}
                        <div className="tarot-interpretation">
                          <div className="tarot-interpretation-title">Ответ</div>
                          <div>{formatInterpretation(f.interpretation)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {followups.length < 2 ? (
                  <div className="tarot-followup-area">
                    <div className="tarot-followup-title">Уточнить расклад</div>
                    {followupFreeHint ? <div className="tarot-followup-free-hint">{followupFreeHint}</div> : null}
                    <textarea
                      className="tarot-followup-input"
                      placeholder="Напишите, что хотите уточнить"
                      value={followupQuestion}
                      onChange={(e) => setFollowupQuestion(e.target.value)}
                    />
                    <button
                      type="button"
                      className="tarot-primary-btn"
                      onClick={() => void handleFollowup()}
                      disabled={isFollowupLoading || !followupQuestion.trim()}
                    >
                      <span className="tarot-btn-text">{isFollowupLoading ? 'Получаем ответ…' : 'Спросить ещё'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="tarot-followup-area">
                    <button type="button" className="tarot-primary-btn" onClick={resetSpread}>
                      Задать новый вопрос
                    </button>
                  </div>
                )}
              </>
            )}
            {error && <div className="tarot-error">{error}</div>}
          </div>
          <div className="tarot-footer">
            <button type="button" className="tarot-secondary-btn" onClick={() => setShowCardsView(false)}>
              Назад
            </button>
          </div>
        </section>
      </div>
      {renderPaymentPortal()}
    </div>
  );
}
