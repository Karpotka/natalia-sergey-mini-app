const STORAGE_KEY = 'ns_tg_init_data';
const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

let telegramSdkPromise: Promise<void> | null = null;

/** Подгружаем SDK только в Telegram — во VK скрипт telegram.org падает и мешает запуску. */
export function loadTelegramSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (telegramSdkPromise) return telegramSdkPromise;

  telegramSdkPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TELEGRAM_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn('[Telegram] не удалось загрузить SDK');
      resolve();
    };
    document.head.appendChild(script);
  });

  return telegramSdkPromise;
}

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

function parseTelegramUserIdFromInitDataString(initData: string): string | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const rawUser = params.get('user');
    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as { id?: number | string };
    if (user.id == null) return null;
    const s = String(user.id).trim();
    return /^\d+$/.test(s) ? s : null;
  } catch {
    return null;
  }
}

/** `user.id` из initData (unsafe или разбор строки initData) — для ключей профиля/онбординга. */
export function readTelegramUserId(): string | null {
  const fromUnsafe = webApp()?.initDataUnsafe?.user?.id;
  if (fromUnsafe != null) {
    const s = String(fromUnsafe).trim();
    if (/^\d+$/.test(s)) return s;
  }
  return parseTelegramUserIdFromInitDataString(readTelegramInitData());
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
