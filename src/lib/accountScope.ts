import { detectAppPlatform } from '../platform/detectPlatform';
import { readTelegramUserId } from '../telegram/telegramBootstrap';
import { readVkUserIdFromCachedLaunchParams } from '../vk/vkLaunchParams';

/**
 * Суффикс для ключей localStorage (профиль, онбординг).
 * VK: `_u{id}` (как в исторических ключах), Telegram: `_tg{id}`.
 */
export function readAccountStorageSuffix(): string {
  const platform = detectAppPlatform();
  if (platform === 'telegram') {
    const tid = readTelegramUserId();
    return tid ? `_tg${tid}` : '_tg';
  }
  const uid = readVkUserIdFromCachedLaunchParams();
  return uid ? `_u${uid}` : '';
}

export function profileStorageKey(): string {
  return `natalia-sergey-user-profile${readAccountStorageSuffix()}`;
}
