/** Тексты для пользователя без привязки к VK / Telegram. */

export const NEED_LOGIN = 'Войдите в приложение.';

export const NEED_LOGIN_BALANCE = 'Войдите в приложение, чтобы увидеть счёт астрокоинов.';

export const BALANCE_LOADING = 'Баланс обновится через несколько секунд после входа.';

export const NEED_LOGIN_TOPUP = 'Войдите в приложение, чтобы пополнить счёт.';

export const NEED_LOGIN_SUBSCRIPTION = 'Войдите в приложение, чтобы оплатить подписку.';

export const NEED_LOGIN_TAROT_SHOP =
  'Войдите в приложение, чтобы покупать обложки за астрокоины. Бесплатную можно надеть сразу.';

export const NEED_LOGIN_CONSULT = 'Войдите в приложение, чтобы оставить заявку и оплатить.';

export const BACKEND_UNAVAILABLE =
  'Сервер недоступен. Откройте мини-приложение из меню бота или соцсети.';

export const AUTH_OPEN_FROM_APP = 'Откройте приложение из меню бота или мини-приложения соцсети.';

export const AUTH_NO_JWT = 'Не удалось войти. Обновите страницу или откройте приложение заново.';

export function authFailedMessage(detail: string): string {
  return `Не удалось войти: ${detail}`;
}
