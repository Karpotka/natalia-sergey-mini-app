import {
  DEFAULT_TAROT_BACK_BUNDLED_URL,
  TAROT_BACK_IMAGE_URLS,
  type TarotBackImageFile,
} from '../../assets/tarotBackImages';
import type { TarotBackShopItem } from '../../api/mysticApi';

/** ID локальных обложек (не пересекаются с каталогом API). */
export const LOCAL_TAROT_BACK_ID_MIN = 9001;
export const LOCAL_TAROT_BACK_ID_MAX = 9099;

const EQUIPPED_KEY = 'ns_tarot_back_equipped_v1';
const OWNED_KEY = 'ns_tarot_back_owned_v1';

/** Локальные ID, снятые с витрины (миграция localStorage). */
const RETIRED_LOCAL_TAROT_BACK_IDS = new Set([9003]);

const LOCAL_FILE_BY_ID: Record<number, TarotBackImageFile> = {
  9001: 'back-star.png',
  9002: 'back-sun-moon.png',
  9004: 'back-lotus.png',
};

/** Старый каталог Deluxe Moon / API — не показываем в магазине. */
const LEGACY_TAROT_BACK_NAME_RE =
  /(?:^|[\s,.:;—-]+)(?:свиток|обычн(?:ый|ая|ое|ые)?|камен(?:ь|я|и|ю|ем)?|кристалл(?:а|у|ом|е)?|золот(?:ые?\s*карт|ая|ой|ое|ые)?|scroll|ordinary|stone|crystal|gold(?:en)?(?:\s*cards?)?)(?:[\s,.:;—-]|$)/i;

const LEGACY_TAROT_BACK_IMAGE_RE =
  /(?:scroll|stone|crystal|gold|ordinary|свиток|камен|кристалл|золот)/i;

export function isLegacyTarotBackExcluded(
  item: Pick<TarotBackShopItem, 'name' | 'imageUrl'>,
): boolean {
  const name = item.name.trim();
  if (LEGACY_TAROT_BACK_NAME_RE.test(name)) return true;
  const url = item.imageUrl.trim();
  if (url && LEGACY_TAROT_BACK_IMAGE_RE.test(url)) return true;
  return false;
}

export function isLocalTarotBackId(id: number): boolean {
  return id >= LOCAL_TAROT_BACK_ID_MIN && id <= LOCAL_TAROT_BACK_ID_MAX;
}

/** URL обложки: сначала бандл Vite (для VK), иначе public/tarot. */
export function tarotBackAssetUrl(fileName: string): string {
  if (fileName in TAROT_BACK_IMAGE_URLS) {
    return TAROT_BACK_IMAGE_URLS[fileName as TarotBackImageFile];
  }
  const base = import.meta.env.BASE_URL || '/';
  return `${base}tarot/${fileName}`.replace(/([^:]\/)\/+/g, '$1');
}

export function localTarotBackImageUrl(id: number): string | null {
  const file = LOCAL_FILE_BY_ID[id];
  return file ? tarotBackAssetUrl(file) : null;
}

export const DEFAULT_LOCAL_TAROT_BACK_ID = 9001;

const CATALOG_DEFS = [
  { id: 9001, name: 'Звёздный компас', file: 'back-star.png', priceCrystals: 0 },
  { id: 9002, name: 'Солнце и Луна', file: 'back-sun-moon.png', priceCrystals: 120 },
  { id: 9004, name: 'Лотос', file: 'back-lotus.png', priceCrystals: 150 },
] as const;

/** Убрать снятые обложки из owned/equipped в localStorage. */
export function sanitizeLocalTarotBackStorage(): void {
  if (typeof localStorage === 'undefined') return;
  const owned = readLocalOwnedIds();
  let changed = false;
  for (const id of RETIRED_LOCAL_TAROT_BACK_IDS) {
    if (owned.delete(id)) changed = true;
  }
  if (changed) writeLocalOwnedIds(owned);

  const eq = readLocalEquippedId();
  if (eq != null && RETIRED_LOCAL_TAROT_BACK_IDS.has(eq)) {
    writeLocalEquippedId(DEFAULT_LOCAL_TAROT_BACK_ID);
  }
}

export function buildLocalTarotBackCatalog(): TarotBackShopItem[] {
  const ownedSet = readLocalOwnedIds();
  if (!ownedSet.has(DEFAULT_LOCAL_TAROT_BACK_ID)) {
    ownedSet.add(DEFAULT_LOCAL_TAROT_BACK_ID);
    writeLocalOwnedIds(ownedSet);
  }
  const equipped = readLocalEquippedId();
  return CATALOG_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    priceCrystals: d.priceCrystals,
    imageUrl: tarotBackAssetUrl(d.file),
    owned: d.priceCrystals === 0 || ownedSet.has(d.id),
    equipped: equipped === d.id,
  }));
}

export function mergeTarotBackShopItems(
  apiItems: TarotBackShopItem[],
  localEquippedHint: number | null,
  apiEquippedHint: number | null,
): TarotBackShopItem[] {
  const local = buildLocalTarotBackCatalog().map((item) => ({
    ...item,
    equipped: localEquippedHint === item.id,
  }));
  const byId = new Map<number, TarotBackShopItem>();
  for (const item of local) byId.set(item.id, item);
  for (const item of apiItems) {
    if (isLocalTarotBackId(item.id)) continue;
    if (isLegacyTarotBackExcluded(item)) continue;
    byId.set(item.id, {
      ...item,
      equipped: apiEquippedHint != null && apiEquippedHint === item.id,
    });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function readLocalEquippedId(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const n = Number(localStorage.getItem(EQUIPPED_KEY));
  return isLocalTarotBackId(n) ? n : null;
}

export function writeLocalEquippedId(id: number | null): void {
  if (typeof localStorage === 'undefined') return;
  if (id == null || !isLocalTarotBackId(id)) {
    localStorage.removeItem(EQUIPPED_KEY);
    return;
  }
  localStorage.setItem(EQUIPPED_KEY, String(id));
}

function readLocalOwnedIds(): Set<number> {
  if (typeof localStorage === 'undefined') return new Set([DEFAULT_LOCAL_TAROT_BACK_ID]);
  const raw = localStorage.getItem(OWNED_KEY);
  if (!raw) return new Set([DEFAULT_LOCAL_TAROT_BACK_ID]);
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set([DEFAULT_LOCAL_TAROT_BACK_ID]);
    return new Set(
      arr.filter(
        (x): x is number =>
          typeof x === 'number' && isLocalTarotBackId(x) && !RETIRED_LOCAL_TAROT_BACK_IDS.has(x),
      ),
    );
  } catch {
    return new Set([DEFAULT_LOCAL_TAROT_BACK_ID]);
  }
}

function writeLocalOwnedIds(ids: Set<number>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OWNED_KEY, JSON.stringify([...ids]));
}

export function markLocalTarotBackOwned(id: number): void {
  const set = readLocalOwnedIds();
  set.add(id);
  writeLocalOwnedIds(set);
}

export function resolveTarotBackImageUrl(
  items: TarotBackShopItem[],
  apiEquippedId: number | null,
  localEquippedId: number | null,
): string {
  const activeId =
    localEquippedId ??
    (apiEquippedId != null && apiEquippedId > 0 ? apiEquippedId : null) ??
    DEFAULT_LOCAL_TAROT_BACK_ID;
  const row = items.find((i) => i.id === activeId);
  if (row?.imageUrl) return row.imageUrl;
  return DEFAULT_TAROT_BACK_BUNDLED_URL;
}

export const DEFAULT_CARD_BACK_SRC = DEFAULT_TAROT_BACK_BUNDLED_URL;
