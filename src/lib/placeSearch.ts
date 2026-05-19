/**
 * Поиск мест через Nominatim (как в Runes_test): debounce на стороне вызова + AbortController + кэш.
 */

export type PlaceSuggestion = {
  label: string;
  value: string;
  lat: number;
  lon: number;
  score: number;
  name: string;
  type: string;
};

let activeController: AbortController | null = null;
const cache = new Map<string, PlaceSuggestion[]>();
let lastQuery = '';

type FetchOpts = {
  countryCode?: string;
  language?: string;
  limit?: number;
};

export async function fetchPlaceSuggestions(query: string, opts: FetchOpts = {}): Promise<PlaceSuggestion[]> {
  const { countryCode = '', language = 'ru', limit = 10 } = opts;

  const q = (query || '').trim();
  if (q.length < 2) return [];

  const cacheKey = `${language}|${countryCode || ''}|${q.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  if (activeController) activeController.abort();
  activeController = new AbortController();
  lastQuery = q;

  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: String(limit),
    addressdetails: '1',
    dedupe: '1',
    'accept-language': language,
  });
  if (countryCode) params.set('countrycodes', countryCode);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: activeController.signal,
    });

    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    if (q !== lastQuery) return [];

    const queryLower = q.toLowerCase();
    const placeTypes = [
      'city',
      'town',
      'village',
      'hamlet',
      'locality',
      'suburb',
      'neighbourhood',
      'administrative',
    ];

    const results = data
      .map((item: Record<string, unknown>) => {
        const name = String(item.name || '').trim();
        const displayName = String(item.display_name || name || '').trim();
        const type = String(item.type || '');
        const cls = String(item.class || '');

        const isPlace = cls === 'place' && placeTypes.includes(type);
        const isAdminBoundary = cls === 'boundary' && type === 'administrative';
        if (!isPlace && !isAdminBoundary) return null;

        const nameLower = name.toLowerCase();
        const displayLower = displayName.toLowerCase();

        let score = 0;
        if (nameLower === queryLower) score = 1000;
        else if (nameLower.startsWith(queryLower)) score = 600;
        else if (displayLower.startsWith(queryLower)) score = 300;
        else if (nameLower.includes(queryLower)) score = 120;
        else if (displayLower.includes(queryLower)) score = 60;

        const imp = typeof item.importance === 'number' ? item.importance : 0;
        score += imp * 5;

        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        return {
          label: displayName,
          value: displayName,
          lat,
          lon,
          score,
          name,
          type,
        } satisfies PlaceSuggestion;
      })
      .filter(Boolean) as PlaceSuggestion[];

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, 5);
    cache.set(cacheKey, top);
    return top;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return [];
    console.error('[placeSearch]', error);
    return [];
  }
}
