import tarotMeaningsJson from './tarotMeanings.json';
import { getCardById, type DrawnTarotCard } from './cards';

type MeaningBranch = { meaning?: string; advice?: string };
type MeaningEntry = {
  overview?: string;
  upright?: MeaningBranch;
  reversed?: MeaningBranch;
};

const meanings = tarotMeaningsJson as Record<string, MeaningEntry>;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

export function drawLocalSpread(count: number, seed: number): DrawnTarotCard[] {
  const rand = rng(seed);
  const ids = Array.from({ length: 78 }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  const picked: DrawnTarotCard[] = [];
  for (let k = 0; k < count; k++) {
    const id = ids[k]!;
    const card = getCardById(id);
    if (card) picked.push({ ...card, reversed: rand() > 0.72 });
  }
  return picked;
}

function cardParagraphFromMeanings(card: DrawnTarotCard): string {
  const m = meanings[String(card.id)];
  if (!m) return `${card.name}: прислушайтесь к образу карты в контексте вашего вопроса.`;
  const branch = card.reversed ? m.reversed : m.upright;
  const parts = [m.overview, branch?.meaning, branch?.advice].filter(Boolean);
  return parts.join(' ');
}

export function buildLocalInterpretation(question: string, cards: DrawnTarotCard[]): string {
  const list = cards.map((c) => `${c.name}${c.reversed ? ' (перевёрнутая)' : ''}`).join(', ');
  const body = cards.map(cardParagraphFromMeanings).join('\n\n');
  return `Карты в раскладе: ${list}.\n\nВопрос: «${question.trim()}».\n\n${body}`;
}
