import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isBackendEnabled } from '../../../api/config';
import { runesFlip } from '../../../api/mysticApi';
import { useSession } from '../../../context/SessionContext';
import { useTarotBackSkin } from '../../../context/TarotBackSkinContext';
import { getCardById, getCardByName, tarotCardsData, type TarotCardRecord } from './cards';
import './TarotRunes.css';
import './TarotDayCard.css';

type Props = {
  onOpenSpreads: () => void;
};

type DayCardState = {
  name: string;
  card_key: string | null;
  interpretation: string;
  reversed: boolean;
};

/** Запасное соотношение сторон (~типичная вертикальная карта), пока не измерили PNG */
const DEFAULT_CARD_ASPECT = 11 / 19;

function readBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return undefined;
}

function parseCardByKey(key: string | null, name: string): TarotCardRecord | null {
  if (key) {
    const id = parseInt(key.replace('*', '').trim(), 10);
    if (Number.isFinite(id)) {
      const byId = getCardById(id);
      if (byId) return byId;
    }
  }
  return getCardByName(name);
}

function fallbackDayCard(): DayCardState {
  const major = tarotCardsData.majorArcana;
  const i = Math.abs(new Date().getDate()) % major.length;
  const card = major[i];
  return {
    name: card?.name ?? 'Карта дня',
    card_key: card ? String(card.id) : null,
    interpretation: 'Фокус на главном. Спокойный темп.',
    reversed: false,
  };
}

export function TarotDayCard({ onOpenSpreads }: Props) {
  const { token } = useSession();
  const { cardBackSrc } = useTarotBackSkin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DayCardState>(() => fallbackDayCard());
  const [isFlipped, setIsFlipped] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cardAspect, setCardAspect] = useState<number | null>(null);
  const backImgRef = useRef<HTMLImageElement>(null);
  const frontImgRef = useRef<HTMLImageElement>(null);

  const payloadKey = `${payload.card_key ?? ''}|${payload.name}|${payload.reversed ? 'r' : 'u'}`;
  const prevPayloadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isBackendEnabled() || !token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = (await runesFlip({}, token)) as Record<string, unknown>;
        const name = String(res.name ?? res.card_name ?? '').trim();
        const interpretation = String(res.interpretation ?? '').trim();
        const cardKeyRaw = res.card_key;
        const card_key = cardKeyRaw == null ? null : String(cardKeyRaw);
        const reversedFromKey = Boolean(card_key?.trim().endsWith('*'));
        const reversedFromApi = readBool(res.reversed) === true || readBool(res.is_reversed) === true;
        const reversed = reversedFromApi || reversedFromKey;
        if (!cancelled) {
          setPayload({
            name: name || 'Карта дня',
            card_key,
            reversed,
            interpretation:
              interpretation || 'Фокус и аккуратные шаги. Не спешите.',
          });
        }
      } catch {
        if (!cancelled) setError('Офлайн-вариант карты дня.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!loading) return;
    setIsFlipped(false);
    setDetailsVisible(false);
  }, [loading]);

  useEffect(() => {
    if (prevPayloadKeyRef.current === null) {
      prevPayloadKeyRef.current = payloadKey;
      return;
    }
    if (prevPayloadKeyRef.current === payloadKey) return;
    prevPayloadKeyRef.current = payloadKey;
    setIsFlipped(false);
    setDetailsVisible(false);
  }, [payloadKey]);

  const card = useMemo(() => parseCardByKey(payload.card_key, payload.name), [payload.card_key, payload.name]);
  const cardImage = card?.image ?? cardBackSrc;

  const measureCardAspect = useCallback((img: HTMLImageElement) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 8 || h < 8) return;
    setCardAspect(w / h);
  }, []);

  const onCardImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      measureCardAspect(e.currentTarget);
    },
    [measureCardAspect],
  );

  useLayoutEffect(() => {
    const front = frontImgRef.current;
    const back = backImgRef.current;
    const fromFront =
      front?.complete && front.naturalWidth > 0 ? front.naturalWidth / front.naturalHeight : null;
    const fromBack = back?.complete && back.naturalWidth > 0 ? back.naturalWidth / back.naturalHeight : null;
    setCardAspect(fromFront ?? fromBack ?? null);
  }, [cardImage, cardBackSrc]);

  const revealDetails = useCallback(() => {
    setDetailsVisible(true);
  }, []);

  const onFlipTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'transform') return;
      if (!e.currentTarget.classList.contains('is-flipped')) return;
      revealDetails();
    },
    [revealDetails],
  );

  const tryFlip = useCallback(() => {
    if (loading || isFlipped) return;
    if (reduceMotion) {
      setIsFlipped(true);
      revealDetails();
      return;
    }
    setIsFlipped(true);
  }, [loading, isFlipped, reduceMotion, revealDetails]);

  useEffect(() => {
    if (!isFlipped || reduceMotion || detailsVisible) return;
    const id = window.setTimeout(() => {
      setDetailsVisible(true);
    }, 950);
    return () => window.clearTimeout(id);
  }, [isFlipped, reduceMotion, detailsVisible]);

  const lead =
    loading ? 'Загружаем…' : !isFlipped ? 'Нажмите на карту, чтобы открыть.' : null;

  return (
    <div className={`tarot-day-root${reduceMotion ? ' tarot-day-root--reduce-motion' : ''}`}>
      <div className="tarot-day-stars" aria-hidden />
      <div className="tarot-day-inner">
        <section className="product-hero product-hero--consult tarot-day-hero">
          <header className="tarot-day-header">
            <p className="tarot-day-eyebrow">Таро</p>
            <h1 className="tarot-day-title">Карта дня</h1>
          </header>

          {lead ? <p className="tarot-day-lead">{lead}</p> : null}

        <div className="tarot-day-flip-scene" aria-live="polite">
          <button
            type="button"
            className="tarot-day-flip-trigger"
            onClick={tryFlip}
            disabled={loading || isFlipped}
            aria-label={loading ? 'Загрузка карты дня' : isFlipped ? 'Карта открыта' : 'Открыть карту дня'}
          >
            <div
              className={`tarot-day-flip-inner${isFlipped ? ' is-flipped' : ''}`}
              style={{ aspectRatio: cardAspect ?? DEFAULT_CARD_ASPECT }}
              onTransitionEnd={reduceMotion ? undefined : onFlipTransitionEnd}
            >
              <div className="tarot-day-flip-face tarot-day-flip-back">
                <img
                  ref={backImgRef}
                  src={cardBackSrc}
                  alt=""
                  decoding="async"
                  draggable={false}
                  onLoad={onCardImgLoad}
                />
              </div>
              <div className="tarot-day-flip-face tarot-day-flip-front">
                <img
                  key={cardImage}
                  ref={frontImgRef}
                  src={cardImage}
                  alt={detailsVisible ? payload.name : ''}
                  decoding="async"
                  draggable={false}
                  onLoad={onCardImgLoad}
                  style={
                    payload.reversed
                      ? { transform: 'rotate(180deg)', transformOrigin: 'center center' }
                      : undefined
                  }
                />
              </div>
            </div>
          </button>
        </div>

        {isFlipped && !detailsVisible ? (
          <p className="tarot-day-hint tarot-day-hint--after-flip" aria-hidden>
            Секунду…
          </p>
        ) : null}

        {detailsVisible ? (
          <div className="tarot-day-details">
            <h2 className="tarot-day-card-name">{payload.name}</h2>
            <p className="tarot-day-card-text">{payload.interpretation}</p>
            {error ? <p className="tarot-day-error">{error}</p> : null}
            <div className="tarot-day-actions">
              <button type="button" className="btn-ghost tarot-day-spread-btn" onClick={onOpenSpreads}>
                Сделать мини-расклад
              </button>
            </div>
          </div>
        ) : null}
        </section>
      </div>
    </div>
  );
}
