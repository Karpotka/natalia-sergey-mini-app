import { ApiError, isNetworkApiError } from '../api/client';

const TELEGRAM_USERNAME_ORDER_MESSAGE =
  'Нужен видимый @username в Telegram. Включите в настройках → перезапустите приложение → повторите заказ.';

function shallowPayloadStrings(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const o = payload as Record<string, unknown>;
  const chunks: string[] = [];
  for (const key of ['message', 'detail', 'error', 'reason', 'description'] as const) {
    const v = o[key];
    if (typeof v === 'string') chunks.push(v);
  }
  const nested = o.errors ?? o.details;
  if (nested && typeof nested === 'object') {
    try {
      chunks.push(JSON.stringify(nested));
    } catch {
      /* ignore */
    }
  }
  return chunks.join(' ');
}

function combinedApiErrorText(err: ApiError): string {
  return [err.code, err.message, shallowPayloadStrings(err.payload)].filter(Boolean).join(' ');
}

/** Эвристика по тексту/коду ответа бэкенда (точные строки могут отличаться). */
export function isTelegramUsernameMissingForOrderError(error: unknown): boolean {
  const text =
    error instanceof ApiError
      ? combinedApiErrorText(error).toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : '';
  if (!text) return false;

  if (
    /no_telegram_username|telegram_username_required|username_not_visible|hidden_username|telegram_username_missing/i.test(
      text,
    )
  ) {
    return true;
  }

  const mentionsTg = /telegram|телег|tg_username|tg username/i.test(text);
  const mentionsUsername = /username|юзернейм|@username|имя пользователя|ник в телег/i.test(text);
  const negative =
    /(отсутств|не задан|нет|required|missing|empty|not set|скрыт|недоступ|не сохран|не указан|нужен|нужно|должен)/i.test(
      text,
    );

  if (mentionsUsername && negative) return true;
  if (mentionsTg && mentionsUsername && negative) return true;

  return false;
}

function isNotFoundConsultApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 404) return true;
  const m = (error.message || '').trim().toLowerCase();
  return m === 'not found' || m === 'не найдено';
}

/**
 * Ошибки каталога/оплаты консультаций: 404 и «Not Found» из API заменяем на понятный текст
 * (часто маршрут не задеплоен или блокирует CORS).
 */
export function formatConsultApiErrorForUser(error: unknown): string {
  if (isTelegramUsernameMissingForOrderError(error)) return TELEGRAM_USERNAME_ORDER_MESSAGE;
  if (isNetworkApiError(error) && error instanceof ApiError) return error.message;
  if (isNotFoundConsultApiError(error)) {
    return 'Сервис оплаты недоступен. Попробуйте позже или напишите в поддержку.';
  }
  return formatPaymentOrOrderErrorForUser(error);
}

/** Сообщение для блока оплаты / заказа: приоритет — подсказка про Telegram username. */
export function formatPaymentOrOrderErrorForUser(error: unknown): string {
  if (isTelegramUsernameMissingForOrderError(error)) return TELEGRAM_USERNAME_ORDER_MESSAGE;
  if (error instanceof ApiError) return error.message || `Ошибка: ${error.code}`;
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить операцию. Попробуйте позже.';
}

/** Текст из VK Bridge / `window.open` — тот же разбор, что и для `ApiError`. */
export function formatPaymentUserFacingMessage(messageOrError: string | unknown): string {
  if (typeof messageOrError === 'string') {
    if (isTelegramUsernameMissingForOrderError(new Error(messageOrError))) return TELEGRAM_USERNAME_ORDER_MESSAGE;
    return messageOrError;
  }
  return formatPaymentOrOrderErrorForUser(messageOrError);
}
