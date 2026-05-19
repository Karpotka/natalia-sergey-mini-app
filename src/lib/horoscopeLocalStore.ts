const LUCKY_LAST_KEY = 'ns_horoscope_lucky_last_v1';

export type LuckyDayLastResult = {
  savedAt: number;
  dayKey: string;
  text: string;
  query?: string;
};

export function loadLuckyDayLast(): LuckyDayLastResult | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LUCKY_LAST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LuckyDayLastResult;
    if (!data?.dayKey || typeof data.dayKey !== 'string') return null;
    return {
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
      dayKey: data.dayKey,
      text: typeof data.text === 'string' ? data.text : '',
      query: typeof data.query === 'string' ? data.query : undefined,
    };
  } catch {
    return null;
  }
}

export function saveLuckyDayLast(result: Omit<LuckyDayLastResult, 'savedAt'>): void {
  if (typeof localStorage === 'undefined') return;
  const payload: LuckyDayLastResult = { ...result, savedAt: Date.now() };
  localStorage.setItem(LUCKY_LAST_KEY, JSON.stringify(payload));
}
