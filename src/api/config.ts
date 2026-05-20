import { isMiniAppEnvironment } from '../platform/detectPlatform';
import { getApiBase } from './resolveApiBase';

/** @deprecated используйте getApiBase() — для same-origin база зависит от window.location. */
export const API_BASE = getApiBase();

export const DOCS_URL = 'https://serg.srvmysticode.ru/docs/#/';

/**
 * Сеть к API:
 * - `VITE_ENABLE_BACKEND=true` — всегда включено;
 * - `VITE_ENABLE_BACKEND=false` — всегда выключено (только UI);
 * - иначе: в VK или Telegram Mini App включаем автоматически.
 * Вне мини-приложений для продакшена задайте `VITE_ENABLE_BACKEND=true` в `.env` при сборке.
 */
export function isBackendEnabled(): boolean {
  const v = import.meta.env.VITE_ENABLE_BACKEND;
  if (v === 'false') return false;
  if (v === 'true') return true;
  if (typeof window !== 'undefined') {
    try {
      return isMiniAppEnvironment();
    } catch {
      return false;
    }
  }
  return false;
}

/** Только для локальной отладки: JWT как в Swagger (Bearer). */
export function readDevBearer(): string | undefined {
  const t = import.meta.env.VITE_DEV_BEARER_TOKEN as string | undefined;
  return t?.trim() || undefined;
}
