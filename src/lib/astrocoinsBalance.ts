/**
 * Остаток астрокоинов на счёте из JSON ответа API.
 *
 * Сначала явные поля кошелька. Если их нет, а в ответе есть строка `interpretation`
 * (типичный ответ `/tarot/generate` и `/tarot/generate/pay`), поле `crystal` на бэкенде
 * часто передаёт **остаток** после списания — используем только вместе с `session_id`,
 * чтобы не спутать с полем «цена» в других ответах.
 */
const WALLET_KEYS = [
  'score_crystal',
  'scoreCrystal',
  'balance_crystal',
  'balanceCrystal',
  'crystals_balance',
  'crystalsBalance',
] as const;

export function pickWalletAstrocoinBalance(raw: unknown): number | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  for (const k of WALLET_KEYS) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Math.trunc(Number(v.trim()));
  }
  const st = o.status;
  if (st === 'ok' || st === 'already_bought') {
    const extra = ['new_crystal', 'newCrystal', 'crystal_balance', 'crystalBalance'] as const;
    for (const k of [...WALLET_KEYS, ...extra]) {
      const v = (o as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.trunc(v);
      if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Math.trunc(Number(v.trim()));
    }
  }
  const nested = o.profile ?? o.user ?? o.data;
  if (nested && typeof nested === 'object' && nested !== o) {
    const sub = pickWalletFromObjectShallow(nested as Record<string, unknown>);
    if (sub !== undefined) return sub;
  }
  const sid = o.session_id ?? o.SessionID;
  const interp = o.interpretation ?? o.Interpretation;
  if (typeof interp === 'string' && interp.trim().length > 0 && typeof sid === 'number' && Number.isFinite(sid)) {
    const c = o.crystal ?? o.Crystal;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) return Math.trunc(c);
    if (typeof c === 'string' && /^-?\d+$/.test(c.trim())) return Math.trunc(Number(c.trim()));
  }
  return undefined;
}

function pickWalletFromObjectShallow(o: Record<string, unknown>): number | undefined {
  for (const k of WALLET_KEYS) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Math.trunc(Number(v.trim()));
  }
  return undefined;
}
