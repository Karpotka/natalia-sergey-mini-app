import { ApiError, isNetworkApiError } from '../../api/client';
import type { CrystalPackMoney } from '../../api/mysticApi';

export const TOPUP_AMOUNTS = [100, 500, 1000, 3000, 5000] as const;

export type PackMeta = { id: number; priceMoney?: number };

export function formatCoinsNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ');
}

export function formatRub(n: number): string {
  return formatCoinsNumber(n) + ' ₽';
}

export function formatStars(n: number): string {
  return `${formatCoinsNumber(n)} ⭐`;
}

export function formatTopupLoadError(error: unknown): string {
  if (error instanceof ApiError && isNetworkApiError(error)) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  }
  return 'Не удалось загрузить номиналы. Попробуйте чуть позже.';
}

function readCrystalPackIdFromEnv(amount: number): number | null {
  const key =
    amount === 100
      ? 'VITE_CRYSTAL_PACK_ID_100'
      : amount === 500
        ? 'VITE_CRYSTAL_PACK_ID_500'
        : amount === 1000
          ? 'VITE_CRYSTAL_PACK_ID_1000'
          : amount === 3000
            ? 'VITE_CRYSTAL_PACK_ID_3000'
            : amount === 5000
              ? 'VITE_CRYSTAL_PACK_ID_5000'
              : '';
  if (!key) return null;
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function buildMoneyPackMap(packs: CrystalPackMoney[]): Partial<Record<number, PackMeta>> {
  const out: Partial<Record<number, PackMeta>> = {};
  for (const amount of TOPUP_AMOUNTS) {
    const fromEnv = readCrystalPackIdFromEnv(amount);
    if (fromEnv) {
      const row = packs.find((p) => p.id === fromEnv);
      out[amount] = {
        id: fromEnv,
        priceMoney: row && Number.isFinite(row.price_money) ? Math.round(row.price_money) : amount,
      };
      continue;
    }
    const row = packs.find((p) => Number(p.crystals) === amount);
    if (row?.id && row.id > 0) {
      out[amount] = {
        id: row.id,
        priceMoney: Number.isFinite(row.price_money) ? Math.round(row.price_money) : amount,
      };
    }
  }
  return out;
}
