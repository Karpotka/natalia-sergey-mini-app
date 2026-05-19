const KEY = 'astro-vesper-payment-flow-v1';

type PaymentFlowKind = 'subscription' | 'service' | 'crystal_topup';

type PaymentFlowState = {
  kind: PaymentFlowKind;
  startedAt: number;
};

function readRaw(): PaymentFlowState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PaymentFlowState>;
    if (
      (p.kind !== 'subscription' && p.kind !== 'service' && p.kind !== 'crystal_topup') ||
      !Number.isFinite(p.startedAt)
    ) {
      return null;
    }
    return { kind: p.kind, startedAt: p.startedAt as number };
  } catch {
    return null;
  }
}

export function markPaymentFlowStarted(kind: PaymentFlowKind) {
  try {
    const payload: PaymentFlowState = { kind, startedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* */
  }
}

export function readPaymentFlowState(): PaymentFlowState | null {
  const s = readRaw();
  if (!s) return null;
  // Без вечных "хвостов": считаем платёжный flow актуальным 45 минут.
  if (Date.now() - s.startedAt > 45 * 60 * 1000) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* */
    }
    return null;
  }
  return s;
}

export function clearPaymentFlowState() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* */
  }
}
