/** «Быстрый доступ» — тонкие золотые контуры в духе референса (currentColor). */

const vb = '0 0 40 40';
const rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function IconQuickDayCard() {
  return (
    <svg viewBox={vb} width={34} height={34} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
        {rays.map((deg, i) => (
          <line
            key={deg}
            x1="20"
            y1={i % 2 === 0 ? 3.5 : 5.5}
            x2="20"
            y2={i % 2 === 0 ? 9 : 10.5}
            transform={`rotate(${deg} 20 20)`}
          />
        ))}
        <circle cx="20" cy="20" r="7" />
        <circle cx="17.5" cy="19" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="22.5" cy="19" r="0.85" fill="currentColor" stroke="none" />
        <path d="M17.2 23.2Q20 25.4 22.8 23.2" />
      </g>
    </svg>
  );
}

export function IconQuickSpread() {
  return (
    <svg viewBox={vb} width={34} height={34} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round">
        <rect x="6.5" y="11" width="12.5" height="18.5" rx="2" transform="rotate(-14 12.75 20.25)" />
        <rect x="15" y="8" width="14" height="21" rx="2.2" />
        <path d="M22 15.5l1.4 2.8 3.1.5-2.2 2.1.5 3.1-2.8-1.5-2.8 1.5.5-3.1-2.2-2.1 3.1-.5z" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}

export function IconQuickConsult() {
  return (
    <svg viewBox={vb} width={34} height={34} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="15.5" r="4.2" />
        <path d="M11.5 29.5q8.5-7.5 17 0" />
        <circle cx="10.5" cy="13" r="1.55" />
        <circle cx="29.5" cy="14.5" r="1.55" />
        <circle cx="20" cy="7" r="1.55" />
      </g>
    </svg>
  );
}

export function IconQuickHoroscope() {
  return (
    <svg viewBox={vb} width={34} height={34} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round">
        <circle cx="20" cy="20" r="13" />
        <circle cx="20" cy="20" r="3.2" />
        {rays.map((deg) => (
          <line key={deg} x1="20" y1="7.5" x2="20" y2="11" transform={`rotate(${deg} 20 20)`} />
        ))}
      </g>
    </svg>
  );
}
