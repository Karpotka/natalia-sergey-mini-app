const rawDefault = 'https://serg.srvmysticode.ru';

/**
 * База API для fetch.
 * - `https://serg.srvmysticode.ru` — явный хост (нужен CORS на бэке для Telegram с другого домена).
 * - `same-origin` — тот же домен, что и фронт (нет CORS): разместите dist на serg.srvmysticode.ru.
 * - `/api` — прокси Vite в dev (см. vite.config.ts).
 */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined) ?? rawDefault;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (trimmed === 'same-origin' || trimmed === './' || trimmed === '.') {
    if (typeof window !== 'undefined') return window.location.origin;
    return rawDefault;
  }

  if (trimmed.length > 0) {
    if (trimmed.startsWith('/')) {
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${trimmed}`.replace(/\/$/, '');
      }
      return trimmed.replace(/\/$/, '');
    }
    return trimmed.replace(/\/$/, '');
  }

  return rawDefault;
}

export function isApiCrossOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(getApiBase()).origin !== window.location.origin;
  } catch {
    return true;
  }
}

export const API_DEFAULT_HOST = rawDefault;
