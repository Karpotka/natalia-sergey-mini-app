import vkBridge from '@vkontakte/vk-bridge';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function positiveIntFromUnknown(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.trunc(v);
  if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) {
    const n = Number(v.trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  return null;
}

function isVkMiniAppWebView(): boolean {
  try {
    if (typeof vkBridge.isWebView === 'function') return vkBridge.isWebView();
    if (typeof vkBridge.isEmbedded === 'function') return vkBridge.isEmbedded();
    return true;
  } catch {
    return false;
  }
}

export function invoiceUrlFromPaymentResponse(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const direct = raw.invoice_url ?? raw.invoiceUrl ?? raw.url;
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const data = raw.data;
  if (isRecord(data)) {
    const nested = data.invoice_url ?? data.invoiceUrl ?? data.url;
    if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim();
  }
  return null;
}

export function parseVkOpenPayFormFromOrderResponse(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const f = raw.vk_open_pay_form;
  if (!isRecord(f)) return null;
  const appId = positiveIntFromUnknown(f.app_id);
  const action = f.action;
  const params = f.params;
  if (appId == null) return null;
  if (typeof action !== 'string') return null;
  if (!isRecord(params)) return null;
  return { app_id: appId, action, params };
}

type BridgeSend = (method: string, props?: Record<string, unknown>) => Promise<unknown>;

export async function openVkOrderPayment(raw: unknown): Promise<{ ok: true } | { error: string }> {
  if (!isRecord(raw)) return { error: 'Сервер не вернул данные оплаты VK.' };
  const send = vkBridge.send as BridgeSend;
  const openPay = parseVkOpenPayFormFromOrderResponse(raw);
  try {
    if (openPay) {
      await send('VKWebAppOpenPayForm', openPay);
      return { ok: true };
    }
    const item = raw.vk_item;
    if (item === undefined || item === null) {
      return { error: 'Сервер не вернул vk_item или vk_open_pay_form для оплаты VK.' };
    }
    await send('VKWebAppShowOrderBox', { type: 'item', item });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось открыть оплату VK.' };
  }
}

/**
 * Открывает внешнюю оплату (ЮKassa и т.п.).
 * В VK WebView на телефоне `window.open` часто блокируется — используем VKWebAppOpenURL.
 */
export async function openPaymentInvoiceUrl(url: string): Promise<{ ok: true } | { error: string }> {
  if (!url || !/^https?:\/\//i.test(url)) return { error: 'Некорректная ссылка на оплату.' };

  if (isVkMiniAppWebView()) {
    try {
      const send = vkBridge.send as BridgeSend;
      await send('VKWebAppOpenURL', { url });
      return { ok: true };
    } catch {
      /* fallback ниже */
    }
  }

  try {
    window.location.assign(url);
    return { ok: true };
  } catch {
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return { ok: true };
      return { error: 'Не удалось открыть окно оплаты. Разрешите всплывающие окна или откройте ссылку в браузере.' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Не удалось открыть оплату.' };
    }
  }
}
