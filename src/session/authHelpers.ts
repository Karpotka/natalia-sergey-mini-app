export function readEquipBackgroundId(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const equip = (raw as Record<string, unknown>).equip;
  if (!equip || typeof equip !== 'object') return null;
  const bg = (equip as Record<string, unknown>).background;
  if (typeof bg === 'number' && bg > 0) return bg;
  return null;
}

function tokenFromRecord(o: Record<string, unknown>): string | null {
  const direct =
    o.token ?? o.access_token ?? o.accessToken ?? o.jwt ?? o.bearer_token ?? o.bearerToken;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  return null;
}

/** JWT из ответа init (/vk/init, /initUserDailyRuneHandler). */
export function extractInitJwt(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.allow === false) return null;

  const top = tokenFromRecord(o);
  if (top) return top;

  const nestedKeys = ['data', 'result', 'body', 'payload', 'user'] as const;
  for (const k of nestedKeys) {
    const nested = o[k];
    if (nested && typeof nested === 'object') {
      const t = tokenFromRecord(nested as Record<string, unknown>);
      if (t) return t;
    }
  }
  return null;
}

export function initResponseDenied(raw: unknown): boolean {
  return Boolean(raw && typeof raw === 'object' && (raw as Record<string, unknown>).allow === false);
}
