import type { SpreadId } from '../features/tarot/runes/constants';

const LAST_KEY = 'ns_tarot_last_reading_v1';
const HISTORY_KEY = 'ns_tarot_history_v1';
const MAX_HISTORY = 30;

export type TarotLastReading = {
  savedAt: number;
  spreadId: SpreadId;
  spreadLabel: string;
  question: string;
  interpretation: string;
};

export type TarotFollowupRecord = {
  question: string;
  interpretation: string;
};

export type TarotHistoryItem = {
  id: string;
  savedAt: number;
  sessionId?: string | number;
  spreadId: SpreadId;
  spreadLabel: string;
  question: string;
  interpretation: string;
  followups: TarotFollowupRecord[];
  /** legacy */
  interpretationPreview?: string;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeHistoryItem(row: TarotHistoryItem): TarotHistoryItem {
  return {
    ...row,
    interpretation: row.interpretation?.trim() || row.interpretationPreview?.trim() || '',
    followups: Array.isArray(row.followups) ? row.followups : [],
  };
}

export function loadLastReading(): TarotLastReading | null {
  if (typeof localStorage === 'undefined') return null;
  return safeParse<TarotLastReading>(localStorage.getItem(LAST_KEY));
}

export function saveLastReading(r: Omit<TarotLastReading, 'savedAt'>): void {
  if (typeof localStorage === 'undefined') return;
  const payload: TarotLastReading = { ...r, savedAt: Date.now() };
  localStorage.setItem(LAST_KEY, JSON.stringify(payload));
}

export function loadHistory(): TarotHistoryItem[] {
  if (typeof localStorage === 'undefined') return [];
  const rows = safeParse<TarotHistoryItem[]>(localStorage.getItem(HISTORY_KEY)) ?? [];
  return rows.map(normalizeHistoryItem);
}

function writeHistory(rows: TarotHistoryItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, MAX_HISTORY)));
}

export function prependHistory(entry: Omit<TarotHistoryItem, 'id' | 'savedAt' | 'followups'> & { followups?: TarotFollowupRecord[] }): void {
  const row: TarotHistoryItem = {
    ...entry,
    followups: entry.followups ?? [],
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  const prev = loadHistory();
  const withoutDup =
    entry.sessionId != null
      ? prev.filter((x) => x.sessionId !== entry.sessionId)
      : prev;
  writeHistory([row, ...withoutDup]);
}

export function appendFollowupToHistory(
  sessionId: string | number,
  followup: TarotFollowupRecord,
): boolean {
  if (sessionId === '' || sessionId === null || sessionId === undefined) return false;
  const prev = loadHistory();
  const idx = prev.findIndex((x) => x.sessionId === sessionId);
  if (idx < 0) return false;
  const row = prev[idx];
  const nextRow: TarotHistoryItem = {
    ...row,
    followups: [...row.followups, followup],
    savedAt: Date.now(),
  };
  const next = [...prev];
  next[idx] = nextRow;
  next.sort((a, b) => b.savedAt - a.savedAt);
  writeHistory(next);
  return true;
}

export function removeHistoryItem(id: string): void {
  writeHistory(loadHistory().filter((x) => x.id !== id));
}
