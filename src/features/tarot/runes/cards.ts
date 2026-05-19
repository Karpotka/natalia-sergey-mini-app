import tarotCardsJson from './tarotCards.json';

export type TarotCardRecord = {
  id: number;
  name: string;
  nameEn: string;
  number?: number;
  image?: string;
  suit?: string;
  value?: string;
};

export type DrawnTarotCard = TarotCardRecord & { reversed: boolean };

type DeckJson = {
  majorArcana: TarotCardRecord[];
  minorArcana: Record<string, TarotCardRecord[]>;
};

export const tarotCardsData: DeckJson = tarotCardsJson as DeckJson;

export function getCardById(cardId: number | null | undefined): TarotCardRecord | null {
  if (cardId === null || cardId === undefined || Number.isNaN(cardId)) return null;
  const major = tarotCardsData.majorArcana.find((c) => c.id === cardId);
  if (major) return major;
  for (const suit of Object.values(tarotCardsData.minorArcana)) {
    const minor = suit.find((c) => c.id === cardId);
    if (minor) return minor;
  }
  return null;
}

export function getCardByName(cardName: string | null | undefined): TarotCardRecord | null {
  if (!cardName) return null;
  const cleanName = cardName.trim().replace(/[*()]/g, '').trim();
  const normalizedName = cleanName.toLowerCase();

  const major = tarotCardsData.majorArcana.find((card) => {
    const n = card.name.toLowerCase();
    const e = card.nameEn.toLowerCase();
    return n === normalizedName || e === normalizedName || n.includes(normalizedName) || normalizedName.includes(n);
  });
  if (major) return major;

  for (const suit of Object.values(tarotCardsData.minorArcana)) {
    const minor = suit.find((card) => {
      const n = card.name.toLowerCase();
      const e = card.nameEn.toLowerCase();
      return n === normalizedName || e === normalizedName || n.includes(normalizedName) || normalizedName.includes(n);
    });
    if (minor) return minor;
  }
  return null;
}

export function parseSpreadKey(keyString: string): DrawnTarotCard[] {
  return keyString
    .split(',')
    .map((e) => e.trim())
    .map((entry) => {
      const reversed = entry.endsWith('*');
      const idStr = reversed ? entry.slice(0, -1) : entry;
      const id = parseInt(idStr, 10);
      if (Number.isNaN(id)) return null;
      const c = getCardById(id);
      return c ? { ...c, reversed } : null;
    })
    .filter((x): x is DrawnTarotCard => x != null);
}
