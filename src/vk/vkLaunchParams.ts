import vkBridge from '@vkontakte/vk-bridge';
import { ensureVkWebAppInit, isVkAppsHostingHostname, urlLooksLikeVkMiniApp } from './vkBootstrap';

const STORAGE_KEY = 'ns_vk_launch_params_qs';

function fromLocation(): string {
  if (typeof window === 'undefined') return '';
  try {
    const s = window.location.search;
    const part = s.startsWith('?') ? s.slice(1) : s;
    if (part.length > 0) return part;
    const h = window.location.hash;
    if (h.startsWith('#') && h.length > 1) {
      const frag = h.slice(1);
      const qs = frag.startsWith('?') ? frag.slice(1) : frag;
      if (qs.includes('vk_')) return qs;
    }
  } catch {
    /* */
  }
  return '';
}

function fromStorage(): string {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    return s && s.length > 0 ? s : '';
  } catch {
    return '';
  }
}

function persist(q: string) {
  if (!hasVkAuthLaunchParams(q)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, q);
  } catch {
    /* */
  }
}

/** `vk_user_id` из последних сохранённых launch params (sessionStorage), без async. */
export function readVkUserIdFromCachedLaunchParams(): string | null {
  try {
    const q = sessionStorage.getItem(STORAGE_KEY);
    if (!q) return null;
    const p = new URLSearchParams(q);
    const uid = p.get('vk_user_id')?.trim();
    return uid && /^\d+$/.test(uid) ? uid : null;
  } catch {
    return null;
  }
}

/** Достаточно `sign` и `vk_user_id` для проверки подписи на бэке (см. документацию VK Mini Apps). */
export function hasVkAuthLaunchParams(queryWithoutQuestionMark: string): boolean {
  if (!queryWithoutQuestionMark || !queryWithoutQuestionMark.includes('sign=')) return false;
  try {
    const p = new URLSearchParams(queryWithoutQuestionMark);
    const sign = p.get('sign');
    const uid = p.get('vk_user_id');
    return Boolean(sign && sign.length > 0 && uid && uid.length > 0);
  } catch {
    return false;
  }
}

function bridgePayloadToQueryString(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const sign = o.sign;
  const uid = o.vk_user_id;
  if (typeof sign !== 'string' || sign.length === 0) return null;
  if (uid === undefined || uid === null || String(uid).trim().length === 0) return null;

  const keys = Object.keys(o).sort();
  const p = new URLSearchParams();
  for (const k of keys) {
    const v = o[k];
    if (v === undefined || v === null) continue;
    p.set(k, String(v));
  }
  return p.toString();
}

function shouldTryBridge(): boolean {
  if (typeof window === 'undefined') return false;
  if (urlLooksLikeVkMiniApp()) return true;
  if (isVkAppsHostingHostname()) return true;
  try {
    return vkBridge.isEmbedded() || vkBridge.isIframe() || vkBridge.isWebView();
  } catch {
    return isVkAppsHostingHostname();
  }
}

async function fromBridge(): Promise<string> {
  if (!shouldTryBridge()) return '';
  try {
    await ensureVkWebAppInit();
    if (typeof vkBridge.send !== 'function') return '';
    const raw = await vkBridge.send('VKWebAppGetLaunchParams');
    const q = bridgePayloadToQueryString(raw);
    if (q && hasVkAuthLaunchParams(q)) {
      persist(q);
      return q;
    }
  } catch {
    /* */
  }
  return '';
}

/**
 * Строка launch params без ведущего `?` — для тела `POST /vk/init` (`launchParams`).
 * Порядок: URL → sessionStorage (после SPA query часто пропадает) → VK Bridge.
 */
export async function collectVkLaunchParams(): Promise<string> {
  const url = fromLocation();
  if (hasVkAuthLaunchParams(url)) {
    persist(url);
    return url;
  }

  const bridged = await fromBridge();
  if (bridged) return bridged;

  const cached = fromStorage();
  if (hasVkAuthLaunchParams(cached)) return cached;

  return url;
}

/** Реферальный параметр из строки launch params (если ВК его передал). */
export function readVkReferralFromLaunchParams(queryWithoutQuestionMark: string): string | null {
  if (!queryWithoutQuestionMark) return null;
  try {
    const p = new URLSearchParams(queryWithoutQuestionMark);
    const ref = p.get('vk_ref') || p.get('ref') || p.get('referral');
    const s = ref?.trim();
    return s && s.length > 0 ? s : null;
  } catch {
    return null;
  }
}
