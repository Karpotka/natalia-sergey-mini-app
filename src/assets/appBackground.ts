import type { CSSProperties } from 'react';
import homeBgBundled from './home/home-bg.png?url';

/**
 * Сборка Vite — надёжный URL в dist/assets (важно для VK WebView на iOS).
 * public/home/home-bg.png дублируется для обратной совместимости деплоя.
 */
export const APP_BACKGROUND_URL = homeBgBundled;

/** Fallback, если бандл недоступен (dev без импорта) */
export const APP_BACKGROUND_PUBLIC_URL = `${import.meta.env.BASE_URL}home/home-bg.png`;

export function appBackgroundShellStyle(): CSSProperties {
  return {
    ['--app-bg-image' as string]: `url("${APP_BACKGROUND_URL}")`,
  };
}

/** @deprecated используйте appBackgroundShellStyle */
export const homeBackgroundStyle = appBackgroundShellStyle();
export const HOME_BACKGROUND_URL = APP_BACKGROUND_URL;
