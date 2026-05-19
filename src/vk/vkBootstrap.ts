import vkBridge from '@vkontakte/vk-bridge';

let vkInitPromise: Promise<unknown> | null = null;

/** Хостинг VK Mini Apps (открытие этой ссылки в Safari ≠ мини-приложение). */
export function isVkAppsHostingHostname(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h.endsWith('.vk-apps.com') || h.endsWith('.vk-apps.ru') || h === 'vk-apps.com' || h === 'vk-apps.ru';
}

export function urlLooksLikeVkMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('vk_')) return true;
    const h = window.location.hash;
    if (h.length > 1 && h.includes('vk_')) return true;
  } catch {
    /* */
  }
  return false;
}

function shouldInitVk(): boolean {
  try {
    if (urlLooksLikeVkMiniApp()) return true;
    if (isVkAppsHostingHostname()) return true;
    return vkBridge.isEmbedded() || vkBridge.isIframe() || vkBridge.isWebView();
  } catch {
    return urlLooksLikeVkMiniApp() || isVkAppsHostingHostname();
  }
}

/** Запущено внутри клиента ВК — доступны VKWebAppGetGeodata и др. */
export function isVkClientEnvironment(): boolean {
  return shouldInitVk();
}

/** Ранний VKWebAppInit — нужен для VK Mini Apps (мобильный, mvk, десктоп). */
export function ensureVkWebAppInit(): Promise<unknown> | null {
  if (typeof window === 'undefined') return null;
  if (!shouldInitVk()) return null;
  if (typeof vkBridge.send !== 'function') {
    console.warn('[VK] vk-bridge: send недоступен — проверьте alias в vite.config (index.es.js).');
    return null;
  }
  if (vkInitPromise) return vkInitPromise;
  vkInitPromise = vkBridge.send('VKWebAppInit').catch((e) => {
    console.warn('[VK] VKWebAppInit:', e);
  });
  return vkInitPromise;
}

export { vkBridge };
