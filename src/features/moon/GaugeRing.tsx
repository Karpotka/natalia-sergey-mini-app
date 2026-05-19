import type { ReactNode } from 'react';

type Props = {
  value: number;
  max: number;
  size: number;
  label: string;
  children?: ReactNode;
};

export function GaugeRing({ value, max, size, label, children }: Props) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, value / max);
  const dash = c * p;

  return (
    <div className="gauge-ring-wrap" style={{ width: size, height: size }}>
      <svg
        className="gauge-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={label}
      >
        <title>{label}</title>
        <circle
          className="gauge-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="gauge-ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gauge-ring-inner">{children}</div>
    </div>
  );
}
