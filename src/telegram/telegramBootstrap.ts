const STORAGE_KEY = 'ns_tg_init_data';

function webApp(): NonNullable<NonNullable<Window['Telegram']>['WebApp']> | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** Запущено внутри Telegram Mini App (есть сырой initData). */
export function isTelegramMiniAppEnvironment(): boolean {
  const tg = webApp();
  const data = tg?.initData?.trim() ?? '';
  if (data.length > 0) return true;
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    return Boolean(cached && cached.length > 0);
  } catch {
    return false;
  }
}

/** Сырой `Telegram.WebApp.initData` для POST /initUserDailyRuneHandler и /auth/refresh. */
export function readTelegramInitData(): string {
  const live = webApp()?.initData?.trim() ?? '';
  if (live) {
    try {
      sessionStorage.setItem(STORAGE_KEY, live);
    } catch {
      /* */
    }
    return live;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function hasTelegramAuthInitData(): boolean {
  return readTelegramInitData().length > 0;
}

/** `start_param` из initDataUnsafe (реферал). */
export function readTelegramReferralParam(): string | null {
  const start = webApp()?.initDataUnsafe?.start_param?.trim();
  return start && start.length > 0 ? start : null;
}

/** ready + expand — как в типичном TWA. */
export function ensureTelegramWebAppReady(): void {
  const tg = webApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch (e) {
    console.warn('[Telegram] WebApp.ready:', e);
  }
}
