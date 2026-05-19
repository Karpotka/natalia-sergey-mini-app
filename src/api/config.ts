import { isVkClientEnvironment } from '../vk/vkBootstrap';

const rawDefault = 'https://serg.srvmysticode.ru';
const rawEnv = (import.meta.env.VITE_API_BASE as string | undefined) ?? rawDefault;
const trimmed = typeof rawEnv === 'string' ? rawEnv.trim() : '';

/** Пустая `VITE_API_BASE` в CI даёт относительный URL и ломает все запросы — откатываемся на дефолт. */
export const API_BASE = (trimmed.length > 0 ? trimmed : rawDefault).replace(/\/$/, '');

export const DOCS_URL = 'https://serg.srvmysticode.ru/docs/#/';

/**
 * Сеть к API:
 * - `VITE_ENABLE_BACKEND=true` — всегда включено;
 * - `VITE_ENABLE_BACKEND=false` — всегда выключено (только UI);
 * - иначе: в клиенте VK Mini App включаем автоматически (чтобы не забыть флаг при сборке).
 * Вне VK для продакшена задайте `VITE_ENABLE_BACKEND=true` в `.env` при сборке.
 */
export function isBackendEnabled(): boolean {
  const v = import.meta.env.VITE_ENABLE_BACKEND;
  if (v === 'false') return false;
  if (v === 'true') return true;
  if (typeof window !== 'undefined') {
    try {
      return isVkClientEnvironment();
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
