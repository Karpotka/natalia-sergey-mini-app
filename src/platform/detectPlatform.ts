import { isTelegramMiniAppEnvironment } from '../telegram/telegramBootstrap';
import { isVkClientEnvironment } from '../vk/vkBootstrap';

export type AppPlatform = 'telegram' | 'vk' | 'browser';

/**
 * Telegram приоритетнее: при открытии в TWA не путаем с VK-хостингом в браузере.
 */
export function detectAppPlatform(): AppPlatform {
  if (isTelegramMiniAppEnvironment()) return 'telegram';
  if (isVkClientEnvironment()) return 'vk';
  return 'browser';
}

export function isMiniAppEnvironment(): boolean {
  const p = detectAppPlatform();
  return p === 'telegram' || p === 'vk';
}
