import vkBridge from '@vkontakte/vk-bridge';
import { isTelegramMiniAppEnvironment } from '../telegram/telegramBootstrap';
import { ensureVkWebAppInit, isVkClientEnvironment } from '../vk/vkBootstrap';

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
  if (!isRecord(raw)) return { error: 'Сервер не вернул данные для оплаты.' };
  const send = vkBridge.send as BridgeSend;
  const openPay = parseVkOpenPayFormFromOrderResponse(raw);
  try {
    if (openPay) {
      await send('VKWebAppOpenPayForm', openPay);
      return { ok: true };
    }
    const item = raw.vk_item;
    if (item === undefined || item === null) {
      return { error: 'Сервер не вернул данные для оплаты в приложении.' };
    }
    await send('VKWebAppShowOrderBox', { type: 'item', item });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось открыть оплату.' };
  }
}

function openViaAnchor(url: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

function openViaWindow(url: string): boolean {
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    return Boolean(opened);
  } catch {
    return false;
  }
}

/** ЮKassa нельзя грузить во iframe (X-Frame-Options). В VK — только внешнее окно / браузер. */
async function openExternalPaymentInVk(url: string): Promise<{ ok: true } | { error: string }> {
  const init = ensureVkWebAppInit();
  if (init) await init;

  const send = vkBridge.send as BridgeSend;
  const bridgeAttempts: Array<Record<string, unknown>> = [
    { url },
    { url, use_external_browser: 1 },
    { url, use_external_browser: true },
  ];

  for (const props of bridgeAttempts) {
    try {
      await send('VKWebAppOpenURL', props);
      return { ok: true };
    } catch {
      /* пробуем следующий вариант */
    }
    try {
      await send('VKWebAppOpenLink', props);
      return { ok: true };
    } catch {
      /* */
    }
  }

  if (openViaAnchor(url)) return { ok: true };
  if (openViaWindow(url)) return { ok: true };

  try {
    const top = window.top ?? window;
    top.location.href = url;
    return { ok: true };
  } catch {
    return {
      error:
        'Не удалось открыть оплату. Разрешите переход по ссылке или откройте приложение в клиенте VK.',
    };
  }
}

function openExternalPaymentInTelegram(url: string): { ok: true } | { error: string } {
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.openLink === 'function') {
    try {
      tg.openLink(url);
      return { ok: true };
    } catch {
      /* fallback */
    }
  }
  if (openViaAnchor(url)) return { ok: true };
  if (openViaWindow(url)) return { ok: true };
  return { error: 'Не удалось открыть оплату во внешнем браузере.' };
}

/** Invoice Telegram Stars (`POST /createInvoiceStars` → `Telegram.WebApp.openInvoice`). */
export async function openTelegramStarsInvoice(
  url: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isTelegramMiniAppEnvironment()) {
    return { error: 'Оплата звёздами недоступна в этом окне.' };
  }
  if (!url || !/t\.me\//i.test(url)) {
    return { error: 'Сервер не вернул ссылку на оплату.' };
  }
  return openTelegramInvoice(url);
}

function openTelegramInvoice(url: string): Promise<{ ok: true } | { error: string }> {
  const tg = window.Telegram?.WebApp;
  if (!tg?.openInvoice) return Promise.resolve({ error: 'Окно оплаты недоступно. Откройте приложение заново.' });

  return new Promise((resolve) => {
    try {
      tg.openInvoice(url, (status) => {
        if (status === 'paid') resolve({ ok: true });
        else if (status === 'cancelled') resolve({ error: 'Оплата отменена.' });
        else if (status === 'failed') resolve({ error: 'Оплата не прошла.' });
        else resolve({ error: 'Оплата не завершена.' });
      });
    } catch (e) {
      resolve({ error: e instanceof Error ? e.message : 'Не удалось открыть оплату.' });
    }
  });
}

/**
 * Открывает внешнюю оплату (ЮKassa / yoomoney).
 * Нельзя использовать `location.assign` внутри VK/Telegram iframe — страница оплаты блокируется.
 */
export async function openPaymentInvoiceUrl(url: string): Promise<{ ok: true } | { error: string }> {
  if (!url || !/^https?:\/\//i.test(url)) return { error: 'Некорректная ссылка на оплату.' };

  if (isTelegramMiniAppEnvironment()) {
    if (/t\.me\//i.test(url)) {
      const tgResult = await openTelegramInvoice(url);
      if ('ok' in tgResult && tgResult.ok) return tgResult;
    }
    return openExternalPaymentInTelegram(url);
  }

  if (isVkClientEnvironment()) {
    return openExternalPaymentInVk(url);
  }

  if (openViaWindow(url)) return { ok: true };
  if (openViaAnchor(url)) return { ok: true };

  try {
    window.location.assign(url);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось открыть оплату.' };
  }
}
