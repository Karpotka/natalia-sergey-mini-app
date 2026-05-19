export const PRODUCT_PANEL_IDS = ['moon', 'horoscope', 'tarot', 'consult', 'profile'] as const;
export type ProductPanelId = (typeof PRODUCT_PANEL_IDS)[number];
