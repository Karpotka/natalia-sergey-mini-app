import type { ProductPanelId } from './productPanelIds';

const vb = '0 0 24 24';

type Props = { id: ProductPanelId; active: boolean };

const sw = 1.35;

/** Нижнее меню: активный — заливка; неактивный — тонкий контур в цвет текста кнопки. */
export function ProductNavRailIcon({ id, active }: Props) {
  const ink = 'currentColor';

  switch (id) {
    case 'moon':
      return (
        <svg viewBox={vb} width={24} height={24} aria-hidden>
          <path
            fill={active ? ink : 'none'}
            stroke={active ? 'none' : ink}
            strokeWidth={active ? 0 : sw}
            strokeLinejoin="round"
            d="M12 2.8 3.2 10.2V21h6.8v-6.5h3.9V21H20.8V10.2L12 2.8z"
          />
        </svg>
      );
    case 'horoscope':
      return (
        <svg viewBox={vb} width={24} height={24} aria-hidden>
          {active ? (
            <>
              <rect x="5.4" y="4.8" width="13.2" height="14.4" rx="2.1" fill={ink} />
              <rect x="7.2" y="6.9" width="9.6" height="2" rx="0.8" fill="rgba(8, 6, 14, 0.8)" />
              <rect x="7.3" y="10.9" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
              <rect x="10.8" y="10.9" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
              <rect x="14.3" y="10.9" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
              <rect x="7.3" y="14.2" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
              <rect x="10.8" y="14.2" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
              <rect x="14.3" y="14.2" width="2" height="2" rx="0.45" fill="rgba(8, 6, 14, 0.85)" />
            </>
          ) : (
            <>
              <rect x="5.4" y="4.8" width="13.2" height="14.4" rx="2.1" fill="none" stroke={ink} strokeWidth={sw} />
              <path d="M5.9 9.1h12.2" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
              <path d="M8.4 6.2v1.8M15.6 6.2v1.8" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
              <circle cx="8.6" cy="12.1" r="0.7" fill={ink} />
              <circle cx="12" cy="12.1" r="0.7" fill={ink} />
              <circle cx="15.4" cy="12.1" r="0.7" fill={ink} />
              <circle cx="8.6" cy="15.2" r="0.7" fill={ink} />
              <circle cx="12" cy="15.2" r="0.7" fill={ink} />
              <circle cx="15.4" cy="15.2" r="0.7" fill={ink} />
            </>
          )}
        </svg>
      );
    case 'tarot':
      return (
        <svg viewBox={vb} width={24} height={24} aria-hidden>
          {active ? (
            <>
              <circle cx="12" cy="12" r="4.4" fill={ink} />
              <path
                d="M12 6.1v2.2M12 15.7v2.2M6.1 12h2.2M15.7 12h2.2M8.1 8.1l1.6 1.6M14.3 14.3l1.6 1.6M15.9 8.1l-1.6 1.6M9.7 14.3l-1.6 1.6"
                fill="none"
                stroke="rgba(8, 6, 14, 0.82)"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="4.4" fill="none" stroke={ink} strokeWidth={sw} />
              <path
                d="M12 5.8v2.1M12 16.1v2.1M5.8 12h2.1M16.1 12h2.1M8.1 8.1l1.5 1.5M14.4 14.4l1.5 1.5M15.9 8.1l-1.5 1.5M9.6 14.4l-1.5 1.5"
                fill="none"
                stroke={ink}
                strokeWidth={sw}
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      );
    case 'consult':
      return (
        <svg viewBox={vb} width={24} height={24} aria-hidden>
          {active ? (
            <>
              <rect x="6.2" y="3.9" width="11.6" height="16.2" rx="1.9" fill={ink} />
              <circle cx="12" cy="11.9" r="2.2" fill="rgba(8, 6, 14, 0.82)" />
              <path
                d="M12 8.1v1.2M12 14.5v1.2M8.2 11.9h1.2M14.6 11.9h1.2"
                stroke="rgba(8, 6, 14, 0.82)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <rect x="6.2" y="3.9" width="11.6" height="16.2" rx="1.9" fill="none" stroke={ink} strokeWidth={sw} />
              <circle cx="12" cy="11.9" r="2.2" fill="none" stroke={ink} strokeWidth={sw} />
              <path d="M12 8.3v1.2M12 14.3v1.2M8.4 11.9h1.2M14.4 11.9h1.2" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
            </>
          )}
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox={vb} width={24} height={24} aria-hidden>
          {active ? (
            <path
              fill={ink}
              d="M12 11a3.1 3.1 0 1 0-3.1-3.1A3.1 3.1 0 0 0 12 11zm-6.6 8.75v-1c0-2 3.3-3.15 6.6-3.15s6.6 1.15 6.6 3.15v1H5.4z"
            />
          ) : (
            <>
              <circle cx="12" cy="8.9" r="3.1" fill="none" stroke={ink} strokeWidth={sw} />
              <path
                fill="none"
                stroke={ink}
                strokeWidth={sw}
                strokeLinecap="round"
                d="M6.4 19.75v-.85c0-1.9 2.35-3.05 5.6-3.05s5.6 1.15 5.6 3.05v.85"
              />
            </>
          )}
        </svg>
      );
    default:
      return null;
  }
}
