import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AstrocoinsBadge } from '../components/AstrocoinsBadge';
import { SPREADS, type SpreadId } from '../features/tarot/runes/constants';
import { TarotDayCard } from '../features/tarot/runes/TarotDayCard';
import { TarotRunesApp } from '../features/tarot/runes/TarotRunesApp';
import '../features/tarot/runes/tarotSpreadModal.css';

export function TarotPage() {
  const [showSpreads, setShowSpreads] = useState(false);
  const [spreadModalOpen, setSpreadModalOpen] = useState(false);
  const [initialSpreadId, setInitialSpreadId] = useState<SpreadId | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tarotDayFlag = searchParams.get('tarotDay');
  const pickSpreadFlag = searchParams.get('pickSpread');

  useEffect(() => {
    if (tarotDayFlag !== '1') return;
    setShowSpreads(false);
    setSpreadModalOpen(false);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('tarotDay');
        return p;
      },
      { replace: true },
    );
  }, [tarotDayFlag, setSearchParams]);

  useEffect(() => {
    if (pickSpreadFlag !== '1') return;
    setSpreadModalOpen(true);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('pickSpread');
        return p;
      },
      { replace: true },
    );
  }, [pickSpreadFlag, setSearchParams]);

  useEffect(() => {
    if (!spreadModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [spreadModalOpen]);

  useEffect(() => {
    if (!spreadModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpreadModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spreadModalOpen]);

  const openSpreadPicker = useCallback(() => setSpreadModalOpen(true), []);

  const closeSpreadModal = useCallback(() => setSpreadModalOpen(false), []);

  const chooseSpread = useCallback((id: SpreadId) => {
    setInitialSpreadId(id);
    setSpreadModalOpen(false);
    setShowSpreads(true);
  }, []);

  const backFromSpreads = useCallback(() => {
    setShowSpreads(false);
    setInitialSpreadId(null);
  }, []);

  const walletRow = (
    <div className="tarot-page-wallet-row">
      <AstrocoinsBadge />
    </div>
  );

  if (showSpreads) {
    return (
      <>
        {walletRow}
        <TarotRunesApp
          key={initialSpreadId ?? 'default'}
          initialSpreadId={initialSpreadId ?? undefined}
          onBackToDayCard={backFromSpreads}
        />
      </>
    );
  }

  const spreadPickerModal =
    spreadModalOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="tarot-spread-modal-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tarot-spread-modal-title"
      >
        <div
          className="tarot-spread-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSpreadModal();
          }}
        />
        <div className="tarot-spread-modal-dialog">
          <div className="tarot-spread-modal-head">
            <h2 id="tarot-spread-modal-title">Мини-расклады</h2>
            <button type="button" className="tarot-spread-modal-close" onClick={closeSpreadModal} aria-label="Закрыть">
              ×
            </button>
          </div>
          <p className="tarot-spread-modal-lead">
            Выберите расклад. Бесплатные попытки — на сервере.
          </p>
          <div className="tarot-spread-modal-grid">
            {SPREADS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="tarot-spread-modal-card"
                onClick={() => chooseSpread(s.id)}
              >
                <span className="tarot-spread-modal-icon" aria-hidden>
                  {s.icon}
                </span>
                <span className="tarot-spread-modal-name">{s.name}</span>
                <span className="tarot-spread-modal-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      {walletRow}
      <TarotDayCard onOpenSpreads={openSpreadPicker} />
      {spreadPickerModal}
    </>
  );
}
