/**
 * Обложки Таро в dist/assets — надёжная загрузка в VK WebView (как home-bg и quick-*).
 */
import backLotus from './tarot-backs/back-lotus.png?url';
import backStar from './tarot-backs/back-star.png?url';
import backSunMoon from './tarot-backs/back-sun-moon.png?url';

export const TAROT_BACK_IMAGE_URLS = {
  'back-star.png': backStar,
  'back-sun-moon.png': backSunMoon,
  'back-lotus.png': backLotus,
} as const;

export type TarotBackImageFile = keyof typeof TAROT_BACK_IMAGE_URLS;

export function tarotBackBundledUrl(file: TarotBackImageFile): string {
  return TAROT_BACK_IMAGE_URLS[file];
}

export const DEFAULT_TAROT_BACK_BUNDLED_URL = backStar;
