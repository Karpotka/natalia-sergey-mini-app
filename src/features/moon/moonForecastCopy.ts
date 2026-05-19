type ForecastDesc = { category: string; rank: number; description: string };
type ForecastMoonday = { id: number; description: ForecastDesc[] };

let moondaysPromise: Promise<ForecastMoonday[]> | null = null;

function forecastUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  return `${trimmed}data/forecast_ru.json`;
}

async function loadMoondays(): Promise<ForecastMoonday[]> {
  const res = await fetch(forecastUrl());
  if (!res.ok) throw new Error(`forecast_ru: HTTP ${res.status}`);
  const data = (await res.json()) as { moondays: ForecastMoonday[] };
  return data.moondays ?? [];
}

function ensureMoondays(): Promise<ForecastMoonday[]> {
  if (!moondaysPromise) moondaysPromise = loadMoondays();
  return moondaysPromise;
}

/**
 * Текст из базы Deluxe Moon (`public/data/forecast_ru.json`): характеристика лунного дня 1…30.
 * До загрузки JSON возвращает пустую строку.
 */
export async function moondayCharacteristicsFromDbAsync(lunarDay: number): Promise<string> {
  const id = Math.min(30, Math.max(1, Math.round(lunarDay)));
  try {
    const rows = await ensureMoondays();
    const row = rows.find((m) => m.id === id);
    if (!row) return '';
    const block = row.description.find((d) => d.category === 'CharacteristicsTitle');
    return typeof block?.description === 'string' ? block.description.trim() : '';
  } catch {
    return '';
  }
}
