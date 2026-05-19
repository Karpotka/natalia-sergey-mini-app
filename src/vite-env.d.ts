/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ENABLE_BACKEND?: string;
  readonly VITE_DEV_BEARER_TOKEN?: string;
  readonly VITE_SUBSCRIPTION_PRODUCT_ID_WEEK?: string;
  readonly VITE_SUBSCRIPTION_PRODUCT_ID_MONTH?: string;
  readonly VITE_SUBSCRIPTION_PRODUCT_ID_YEAR?: string;
  /** Явные id пакетов из GET /crystalMoney для пополнения (если не заданы — ищем по полю `crystals`). */
  readonly VITE_CRYSTAL_PACK_ID_100?: string;
  readonly VITE_CRYSTAL_PACK_ID_500?: string;
  readonly VITE_CRYSTAL_PACK_ID_1000?: string;
  readonly VITE_CRYSTAL_PACK_ID_3000?: string;
  readonly VITE_CRYSTAL_PACK_ID_5000?: string;
  /** Если бэкенд отдаёт каталог по другому пути (по умолчанию `/service/catalog`). */
  readonly VITE_SERVICE_CATALOG_PATH?: string;
  readonly VITE_CONSULT_PRODUCT_ID_ASTROLOGER?: string;
  readonly VITE_CONSULT_PRODUCT_ID_TAROLOGIST?: string;
  readonly VITE_CONSULT_PRODUCT_ID_UNIVERSAL?: string;
  /** Явный id услуги из GET /service/catalog (приоритетнее автосопоставления по названию). */
  readonly VITE_CONSULT_SERVICE_ID_ASTROLOGER?: string;
  readonly VITE_CONSULT_SERVICE_ID_TAROLOGIST?: string;
  readonly VITE_CONSULT_SERVICE_ID_UNIVERSAL?: string;
  /** Id услуги консультации с Натальей Веспер (приоритетнее универсального, если задан). */
  readonly VITE_CONSULT_SERVICE_ID_VESPER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
