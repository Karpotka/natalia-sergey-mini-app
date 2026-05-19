/** 12 знаков — согласование: отдельный экран/выбор по каждому знаку. */

export type ZodiacSign = {
  id: string;
  name: string;
  sym: string;
  /** Грубые границы для подписи (северное полушарие, общая схема) */
  period: string;
};

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: 'aries', name: 'Овен', sym: '♈', period: '21 мар — 19 апр' },
  { id: 'taurus', name: 'Телец', sym: '♉', period: '20 апр — 20 май' },
  { id: 'gemini', name: 'Близнецы', sym: '♊', period: '21 май — 20 июн' },
  { id: 'cancer', name: 'Рак', sym: '♋', period: '21 июн — 22 июл' },
  { id: 'leo', name: 'Лев', sym: '♌', period: '23 июл — 22 авг' },
  { id: 'virgo', name: 'Дева', sym: '♍', period: '23 авг — 22 сен' },
  { id: 'libra', name: 'Весы', sym: '♎', period: '23 сен — 22 окт' },
  { id: 'scorpio', name: 'Скорпион', sym: '♏', period: '23 окт — 21 ноя' },
  { id: 'sagittarius', name: 'Стрелец', sym: '♐', period: '22 ноя — 21 дек' },
  { id: 'capricorn', name: 'Козерог', sym: '♑', period: '22 дек — 19 янв' },
  { id: 'aquarius', name: 'Водолей', sym: '♒', period: '20 янв — 18 фев' },
  { id: 'pisces', name: 'Рыбы', sym: '♓', period: '19 фев — 20 мар' },
];

const CARD_DAY_SEEDS = [
  'спокойное включение в дела без резких поворотов — события просят ясности намерения, а не скорости.',
  'удачный фон для коротких договорённостей и уточнения деталей; избегайте импульсивных обещаний.',
  'день заметнее обычного для наблюдения за телом и режимом; мягкая рутина поддержит ресурс.',
  'отношениям полезна честная формулировка ожиданий — даже одной фразой можно снять напряжение.',
  'финансовые телодвижения лучше планировать малыми шагами; крупные решения перепроверьте завтра утром.',
];

/** Демо-текст «карты дня» без API — направляющий тон по согласованию. */
/** Индекс знака зодиака (0…11) по тропической схеме для календарной даты рождения `YYYY-MM-DD`. */
export function tropicalSunSignIndexFromIsoDate(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const md = m * 100 + day;

  if (md >= 321 && md <= 419) return 0;
  if (md >= 420 && md <= 520) return 1;
  if (md >= 521 && md <= 620) return 2;
  if (md >= 621 && md <= 722) return 3;
  if (md >= 723 && md <= 822) return 4;
  if (md >= 823 && md <= 922) return 5;
  if (md >= 923 && md <= 1022) return 6;
  if (md >= 1023 && md <= 1121) return 7;
  if (md >= 1122 && md <= 1221) return 8;
  if (md >= 1222 || md <= 119) return 9;
  if (md >= 120 && md <= 218) return 10;
  return 11;
}

export function buildDemoCardOfDay(signIndex: number, date: Date): string {
  const sign = ZODIAC_SIGNS[signIndex] ?? ZODIAC_SIGNS[0];
  const daySeed = date.getFullYear() * 400 + (date.getMonth() + 1) * 32 + date.getDate();
  const variant = (daySeed + signIndex * 7) % CARD_DAY_SEEDS.length;
  const body = CARD_DAY_SEEDS[variant];
  return `${sign.sym} ${sign.name}: ${body} (${sign.period}). Это не предсказание, а символический ориентир — подсказка и совет, без гарантии события.`;
}
