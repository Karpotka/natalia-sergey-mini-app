/**
 * Обёртки под Mystic API — сверено с OpenAPI (openapi-7.yaml, бэкенд shepsmystics).
 *
 * Ключевые группы:
 * - Auth: `POST /initUserDailyRuneHandler`, `POST /vk/init`, `POST /auth/refresh`, `POST /auth/vk/refresh`
 * - Карта дня (таро): `POST /flipRune` — {@link runesFlip}
 * - Таро: `GET /tarot/check`, `POST /tarot/open`, `POST /tarot/generate`, `POST /tarot/generate/pay`,
 *   `POST /tarot/generate/follow`, `POST /tarot/generate/follow/pay`, `GET /tarot/history`, `POST /tarot/history/details`
 * - Рунные расклады (`/layoutAllowed`, `/generate`, `/spread/*`) — временно отключены (см. закомментированный блок в файле).
 * - Профиль: `GET /profile`, `POST /profile/addParam`, `POST /profile/changeParam`
 * - Гороскоп: `POST /horoscope/open`, `POST /horoscope/buyHoroscopeFull`, `POST /horoscope/buyFutureHoroscope`,
 *   `POST /horoscope/luckyDay`, `POST /horoscope/lucky/history`
 * - Магазин / кристаллы (в UI — **астрокоины**, те же поля `score_crystal`, `crystal`) / подписка / платежи — см. функции внизу файла.
 * - Обложки Таро: `POST /shop` с типом (`tarot_back`, `tarot_skin`, `background`), `POST /shop/buy`, `POST /equipObject`; в init — `equip.background`.
 */
import { apiGetJson, apiPatchJson, apiPostJson } from './client';

/** Экипировка из init (OpenAPI: equip.background). */
export type EquipState = { background: number };

/** Ответ `POST /vk/init` (инициализация во VK Mini Apps). */
export type VkInitResponse = {
  token: string;
  allow: boolean;
  /** Кристаллы на бэкенде = астрокоины в приложении. */
  score_crystal: number;
  newUserCreated: boolean;
  subscriptionExpired: boolean;
  sound: number;
  equip?: EquipState;
  name: string;
  card_key: string | null;
  interpretation: string | null;
};

export type ProfileSex = 'female' | 'male';

export type ProfileApiModel = {
  id?: number;
  date?: string | null;
  birth_date?: string | null;
  birth_time?: string | null;
  has_exact_time?: boolean | null;
  place_name?: string | null;
  name?: string | null;
  sex?: ProfileSex | null;
  lat?: number | null;
  lon?: number | null;
  tz_name?: string | null;
};

/** Главная точка входа для VK: проверка `sign`, пользователь, JWT, карта дня. Без Bearer. */
export async function vkMiniAppInit(launchParams: string, referralParam: string | null) {
  return apiPostJson<VkInitResponse>('/vk/init', {
    launchParams,
    referralParam: referralParam ?? null,
  });
}

export type InitUserResponse =
  | { allow: false }
  | {
      allow: true;
      token: string;
      /** Кристаллы на бэкенде = астрокоины в приложении. */
      score_crystal: number;
      newUserCreated: boolean;
      subscriptionExpired: boolean;
      sound: number;
      equip?: EquipState;
      name: string;
      card_key: string | null;
      interpretation: string | null;
    };

export async function initUserDailyRune(
  initData: string,
  token?: string | null,
  referralParam?: string | null,
) {
  return apiPostJson<InitUserResponse>(
    '/initUserDailyRuneHandler',
    { initData, referralParam: referralParam ?? null },
    token,
  );
}

/** Тело `POST /horoscope/open` — календарный день гороскопа. */
export type HoroscopeOpenBody = { day: string };

/** Ответ `POST /horoscope/open` (по Swagger). */
export type HoroscopeOpenResponse = {
  ok?: boolean;
  has_profile?: boolean;
  sign_code?: string;
  is_premium?: boolean;
  day_unlocked?: boolean;
  premium_unlocked?: boolean;
  can_view_public?: boolean;
  can_view_premium?: boolean;
  need_buy_day?: boolean;
  need_buy_premium?: boolean;
  general_public?: string | null;
  general_premium?: string | null;
  /** Астрокоины: `prem_horoscope_crystal`, `day_open_crystal`, `lucky_day_crystal` и др. */
  prices?: Record<string, number>;
};

/** `POST /horoscope/open` — открыть гороскоп на указанный день (Bearer). */
export async function horoscopeOpen(dayYmd: string, token: string) {
  return apiPostJson<HoroscopeOpenResponse>('/horoscope/open', { day: dayYmd }, token);
}

export type HoroscopeDayBody = { day: string };

export async function horoscopeBuyHoroscopeFull(body: HoroscopeDayBody, token: string) {
  return apiPostJson<Record<string, unknown>>('/horoscope/buyHoroscopeFull', body, token);
}

export async function horoscopeBuyFutureHoroscope(body: HoroscopeDayBody, token: string) {
  return apiPostJson<Record<string, unknown>>('/horoscope/buyFutureHoroscope', body, token);
}

/** Тело `POST /horoscope/luckyDay` — подбор удачного дня. */
export type HoroscopeLuckyDayBody = {
  /** Свободный текст: профиль + формулировка запроса (см. UI). */
  query: string;
  /** Окно поиска в днях от «сегодня» (например 7, 15 или 30) — как ожидает бэкенд. */
  range_days: number;
  pay: string;
};

/** Ответ `POST /horoscope/luckyDay` (поля могут приходить в snake_case или camelCase). */
export type HoroscopeLuckyDayResponse = {
  ok?: boolean;
  best_day?: string;
  bestDay?: string;
  best_text_ru?: string | null;
  bestTextRu?: string | null;
  crystal?: number;
  error?: string;
};

export async function horoscopeLuckyDay(body: HoroscopeLuckyDayBody, token: string) {
  return apiPostJson<HoroscopeLuckyDayResponse & Record<string, unknown>>('/horoscope/luckyDay', body, token);
}

export async function horoscopeLuckyHistory(token: string) {
  return apiPostJson<Record<string, unknown>>('/horoscope/lucky/history', {}, token);
}

/** Ответ `GET /tarot/check`. */
export type TarotCheckResponse = {
  limit_total: number;
  quota_left: number;
  pr_lim?: number;
};

export async function tarotCheck(token: string) {
  return apiGetJson<TarotCheckResponse>('/tarot/check', token);
}

/** Тело и ответ `POST /tarot/open` — выдача ключа расклада. */
export type TarotOpenBody = { type: string };
export type TarotOpenResponse = {
  need_payment: boolean;
  key: string;
  crystal?: number;
  coin?: number;
};

export async function tarotOpen(body: TarotOpenBody, token: string) {
  return apiPostJson<TarotOpenResponse>('/tarot/open', body, token);
}

/** Тело `POST /tarot/generate` и `POST /tarot/generate/pay`. */
export type TarotGenerateBody = {
  type: string;
  key: string;
  question: string;
};

export type TarotGenerateResponse = {
  interpretation?: string;
  session_id?: number;
};

export async function tarotGenerate(body: TarotGenerateBody, token: string) {
  return apiPostJson<TarotGenerateResponse & Record<string, unknown>>('/tarot/generate', body, token);
}

/** Платный основной расклад (после `need_payment: true` на `/tarot/open`). Тело как у `/tarot/generate`. */
export async function tarotGeneratePay(body: TarotGenerateBody, token: string) {
  return apiPostJson<TarotGenerateResponse & Record<string, unknown>>('/tarot/generate/pay', body, token);
}

/** Тело `POST /tarot/generate/follow` и `POST /tarot/generate/follow/pay` (OpenAPI: camelCase `sessionId`). */
export type TarotGenerateFollowBody = {
  sessionId: number;
  question: string;
};

export async function tarotGenerateFollow(body: TarotGenerateFollowBody, token: string) {
  return apiPostJson<Record<string, unknown>>('/tarot/generate/follow', body, token);
}

export async function tarotGenerateFollowPay(body: TarotGenerateFollowBody, token: string) {
  return apiPostJson<Record<string, unknown>>('/tarot/generate/follow/pay', body, token);
}

export async function tarotHistory(token: string) {
  return apiGetJson<unknown>('/tarot/history', token);
}

/** Тело `POST /tarot/history/details`. */
export type TarotHistoryDetailsBody = { spreadId: number };

export async function tarotHistoryDetails(body: TarotHistoryDetailsBody, token: string) {
  return apiPostJson<Record<string, unknown>>('/tarot/history/details', body, token);
}

/** Legacy refresh (Telegram-style): `POST /auth/refresh` с `{ initData }`. */
export async function authRefresh(initData: string) {
  return apiPostJson<{ token: string }>('/auth/refresh', { initData });
}

/** VK refresh по launch params: `POST /auth/vk/refresh` с `{ launchParams }`. */
export async function authVkRefresh(launchParams: string) {
  return apiPostJson<{ token: string }>('/auth/vk/refresh', { launchParams });
}

export type ProfileAddParamBody = {
  name: string;
  sex: ProfileSex;
  birth_date: string;
  birth_time_str: string | null;
  has_exact_time: boolean;
  place_name: string;
  /** Не передавайте `null`, если координат нет — иначе часть бэков падает с 500 на `changeParam`. */
  lat?: number | null;
  lon?: number | null;
  tz_name: string;
};

export async function profileGet(token: string) {
  return apiGetJson<ProfileApiModel>('/profile', token);
}

export async function profileAddParam(body: ProfileAddParamBody, token: string) {
  return apiPostJson<ProfileApiModel>('/profile/addParam', body, token);
}

export async function profileChangeParam(body: Partial<ProfileAddParamBody>, token: string) {
  return apiPostJson<ProfileApiModel>('/profile/changeParam', body, token);
}

/*
 * --- Руны (расклады): временно отключено — раскомментируйте при возврате раздела ---
 *
 * export type RunesLayoutAllowedResponse = {
 *   allowed: boolean;
 *   used: number;
 *   max: number;
 *   quota_left: number;
 *   window_started_at: string | null;
 *   window_expires_at: string | null;
 *   is_premium: boolean;
 * };
 *
 * export async function runesLayoutAllowed(body: { theme: string; type: string }, token: string) {
 *   return apiPostJson<RunesLayoutAllowedResponse & Record<string, unknown>>('/layoutAllowed', body, token);
 * }
 *
 * export async function runesGenerate(body: Record<string, unknown>, token: string) {
 *   return apiPostJson<Record<string, unknown>>('/generate', body, token);
 * }
 *
 * export async function runesSpreadHistory(token: string) {
 *   return apiGetJson<Record<string, unknown>>('/spread/history', token);
 * }
 *
 * export async function runesSpreadDetails(spreadId: number, token: string) {
 *   return apiGetJson<Record<string, unknown>>(`/spread/details/${spreadId}`, token);
 * }
 */

/** Открыть карту Таро дня (`POST /flipRune`). Тело по спецификации не требуется — передаём пустой объект. */
export async function runesFlip(body: Record<string, unknown>, token: string) {
  return apiPostJson<Record<string, unknown>>('/flipRune', body, token);
}

/** Магазин: список товаров (`POST /shop`). */
export async function shopList(body: { type?: string } | undefined, token: string) {
  return apiPostJson<unknown[]>('/shop', body ?? { type: 'background' }, token);
}

/** Нормализованная позиция каталога обложек рубашки Таро (POST /shop). */
export type TarotBackShopItem = {
  id: number;
  name: string;
  priceCrystals: number;
  imageUrl: string;
  owned: boolean;
  equipped: boolean;
};

function numFromUnknown(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function strFromUnknown(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/** Разбор одной строки ответа POST /shop (поля могут быть в snake_case / camelCase). */
export function parseTarotBackShopRow(raw: unknown, equippedIdHint: number | null): TarotBackShopItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id =
    numFromUnknown(o.id) ??
    numFromUnknown(o.itemId) ??
    numFromUnknown(o.item_id) ??
    numFromUnknown(o.product_id);
  if (id == null || id <= 0) return null;

  const name =
    strFromUnknown(o.name) ??
    strFromUnknown(o.title) ??
    strFromUnknown(o.description) ??
    `Обложка ${id}`;

  const priceCrystals =
    numFromUnknown(o.price) ??
    numFromUnknown(o.price_crystal) ??
    numFromUnknown(o.priceCrystal) ??
    numFromUnknown(o.crystal) ??
    numFromUnknown(o.crystals) ??
    0;

  const imageUrl =
    strFromUnknown(o.image_url) ??
    strFromUnknown(o.imageUrl) ??
    strFromUnknown(o.url) ??
    strFromUnknown(o.image) ??
    strFromUnknown(o.preview) ??
    strFromUnknown(o.picture) ??
    '';

  const owned =
    Boolean(
      o.owned ??
        o.is_owned ??
        o.isOwned ??
        o.purchased ??
        o.bought ??
        o.has_item ??
        o.hasItem ??
        o.in_collection ??
        o.inCollection ??
        o.unlocked,
    ) ||
    o.user_has === true ||
    o.userHas === true;

  const equipped =
    Boolean(o.equipped ?? o.is_equipped ?? o.isEquipped) ||
    (equippedIdHint != null && equippedIdHint > 0 && id === equippedIdHint);

  return { id, name, priceCrystals: Math.max(0, Math.round(priceCrystals)), imageUrl, owned, equipped };
}

/**
 * Каталог обложек рубашки: последовательно запрашивает POST /shop для типов, которые может отдавать бэкенд,
 * объединяет по `id` (без дубликатов).
 */
export async function tarotBackShopList(token: string, equippedIdHint: number | null): Promise<TarotBackShopItem[]> {
  const types = ['tarot_back', 'tarot_skin', 'background'] as const;
  const byId = new Map<number, TarotBackShopItem>();
  for (const type of types) {
    try {
      const rows = await shopList({ type }, token);
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const item = parseTarotBackShopRow(row, equippedIdHint);
        if (item) byId.set(item.id, item);
      }
    } catch {
      /* неизвестный type или пустой каталог для этого type */
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export type ShopBuyResponse =
  | { status: 'ok' | 'already_bought' | 'invalid_price' | 'not_enough_points' }
  | { status: 'not_enough_crystals'; crystalOffers: { crystals: number; price_money: number }[] }
  | { status: 'error'; message: string };

export async function shopBuy(body: { itemId: number }, token: string) {
  return apiPostJson<ShopBuyResponse & Record<string, unknown>>('/shop/buy', body, token);
}

/** Надеть предмет (`POST /equipObject`). Ответ: строка `ok` | `not_owned` | `invalid_item`. */
export async function equipObject(body: { item_id: number }, token: string) {
  return apiPostJson<string>('/equipObject', body, token);
}

/** Тарифы подписки `GET /subscribe`. */
export async function subscribeList() {
  return apiGetJson<{ result: { id: number; description: string; month: number }[] }>('/subscribe');
}

/** Покупка подписки за астрокоины (на бэке — `score_crystal` / кристаллы). `id` = product_id тарифа из каталога. */
export async function subscribeBuy(body: { id: number }, token: string) {
  return apiPostJson<Record<string, unknown>>('/subscribe/buy', body, token);
}

/** Согласие с политикой `GET /politicalAcc/{telegramId}`. */
export async function politicalAcc(telegramId: string) {
  return apiGetJson<{ status: boolean }>(`/politicalAcc/${encodeURIComponent(telegramId)}`);
}

export type CrystalPackMoney = { id: number; crystals: number; price_money: number };
export type CrystalPackStars = { id: number; crystals: number; price_stars: number };
export type CrystalPackVkVotes = { id: number; crystals: number; price_vk_votes: number };

export async function crystalMoneyPackages() {
  return apiGetJson<CrystalPackMoney[]>('/crystalMoney');
}

export async function crystalStarsPackages() {
  return apiGetJson<CrystalPackStars[]>('/crystalStars');
}

export async function crystalVkVotesPackages() {
  return apiGetJson<CrystalPackVkVotes[]>('/crystalVKVotes');
}

export async function soundUpdate(body: { sound: number }, token: string) {
  return apiPostJson<{ status: string }>('/sound', body, token);
}

export type InvoiceCreated = { invoice_url: string; payment_id: string };

export async function createInvoiceRub(body: { id: number; email: string; discountPercent?: number | null }, token: string) {
  return apiPostJson<InvoiceCreated>('/createInvoice', body, token);
}

export async function createInvoiceStars(body: { id: number; discountPercent?: number | null }, token: string) {
  return apiPostJson<InvoiceCreated>('/createInvoiceStars', body, token);
}

export type VkVotesInvoiceResponse = {
  vk_item: string;
  amount_votes: number;
  payment_id: string;
  title?: string;
  description?: string;
};

export async function createInvoiceVKVotes(body: { id: number }, token: string) {
  return apiPostJson<VkVotesInvoiceResponse>('/createInvoiceVKVotes', body, token);
}

export async function createInvoiceCrypto(body: { id: number }, token: string) {
  return apiPostJson<InvoiceCreated>('/createInvoiceCrypto', body, token);
}

export async function paymentsYookassaCardInvoice(body: { id: number; email: string }, token: string) {
  return apiPostJson<InvoiceCreated>('/payments/yookassa/card/invoice', body, token);
}

export async function paymentsYookassaYoomoneyInvoice(body: { id: number; email: string }, token: string) {
  return apiPostJson<InvoiceCreated>('/payments/yookassa/yoomoney/invoice', body, token);
}

function trimServicePath(raw: string | undefined, fallback: string): string {
  const t = (raw ?? '').trim();
  const base = t.length > 0 ? t : fallback;
  return base.startsWith('/') ? base : `/${base}`;
}

const SERVICE_CATALOG_GET_PATH = trimServicePath(import.meta.env.VITE_SERVICE_CATALOG_PATH, '/service/catalog');

export type ServiceCatalogItem = {
  id: number;
  title: string;
  description?: string | null;
  price_money: number;
  input_schema?: Record<string, unknown>;
  sort_order?: number;
  [key: string]: unknown;
};

export async function serviceCatalog(token?: string | null) {
  return apiGetJson<ServiceCatalogItem[]>(SERVICE_CATALOG_GET_PATH, token);
}

export type ServiceOrderYookassaBody = {
  service_id: number;
  pay_method: 'card' | 'yoomoney';
  email: string;
  input_data?: Record<string, unknown>;
};

export type ServiceOrderYookassaResponse = {
  invoice_url: string;
  payment_id: string;
  order_id: number;
};

export async function serviceOrderYookassaInvoice(body: ServiceOrderYookassaBody, token: string) {
  return apiPostJson<ServiceOrderYookassaResponse>('/service/orders/yookassa/invoice', body, token);
}

export async function serviceOrderInputPatch(orderId: number, input_data: Record<string, unknown>, token: string) {
  return apiPatchJson<unknown>(`/service/orders/${orderId}/input`, { input_data }, token);
}

export async function checkPayment(body: { payment_id: string }, token: string) {
  return apiPostJson<string | boolean>('/checkPayment', body, token);
}

// ——— Старые пути оплаты (не в openapi-7); оставлены для совместимости, пока бэкенд не убрал их. ———

export async function subscriptionVkOrder(body: { product_id: number }, token: string) {
  return apiPostJson<Record<string, unknown>>('/subscriptions/payments/vk/order', body, token);
}

export async function subscriptionYookassaCardInvoice(body: { product_id: number; email: string }, token: string) {
  return apiPostJson<Record<string, unknown>>('/subscriptions/payments/yookassa/card/invoice', body, token);
}

export async function subscriptionYookassaYoomoneyInvoice(
  body: { product_id: number; email: string },
  token: string,
) {
  return apiPostJson<Record<string, unknown>>('/subscriptions/payments/yookassa/yoomoney/invoice', body, token);
}

export async function serviceVkOrder(body: { product_id: number }, token: string) {
  return apiPostJson<Record<string, unknown>>('/payments/vk/order', body, token);
}

export type ConsultYookassaPayMethod = 'card' | 'yoomoney';

/**
 * Оплата услуги из каталога (`GET /service/catalog` → `item.id` = `service_id`).
 * Поле `input_data` — параметры заявки (описание запроса, контакты и т.д.) по схеме `input_schema` услуги.
 */
export async function serviceConsultYookassaInvoice(body: ServiceOrderYookassaBody, token: string) {
  return serviceOrderYookassaInvoice(body, token);
}
