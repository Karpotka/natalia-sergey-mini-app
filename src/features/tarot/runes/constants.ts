export const SPREADS = [
  {
    id: 'cross' as const,
    type: 'cross',
    cards: 4,
    name: 'Крест',
    icon: '✛',
    desc: 'Проблема / причина / ресурс / итог',
    description: 'Ситуация: проблема, причина, ресурс, итог.',
  },
  {
    id: 'pentagram' as const,
    type: 'road',
    cards: 5,
    name: '5 карт',
    icon: '✶',
    desc: 'Глубокий анализ ситуации',
    description: 'Глубокий разбор ситуации.',
  },
  {
    id: 'relationship' as const,
    type: 'railstat',
    cards: 7,
    name: 'Отношения',
    icon: '♥',
    desc: 'Чувства, намерения, перспектива',
    description: 'Любовь, дружба, перспектива.',
  },
] as const;

export type SpreadId = (typeof SPREADS)[number]['id'];
