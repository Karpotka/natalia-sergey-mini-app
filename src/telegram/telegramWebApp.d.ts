/** Минимальные типы Telegram Web App SDK (https://telegram.org/js/telegram-web-app.js). */
export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    start_param?: string;
    user?: { id?: number; username?: string; first_name?: string; last_name?: string };
  };
  ready: () => void;
  expand: () => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  close: () => void;
  platform?: string;
  colorScheme?: 'light' | 'dark';
}
