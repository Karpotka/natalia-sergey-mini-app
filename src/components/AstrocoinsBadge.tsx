import { useSession } from '../context/SessionContext';

/** Компактный баланс астрокоинов в шапке. */
export function AstrocoinsBadge() {
  const { token, astrocoins, backendEnabled } = useSession();

  if (!backendEnabled || !token || astrocoins === null) return null;

  return (
    <div
      className="astrocoins-badge"
      title="Астрокоины — внутренняя валюта приложения."
      role="status"
      aria-label={`Астрокоинов: ${astrocoins}`}
    >
      <span className="astrocoins-badge-icon" aria-hidden>
        ✦
      </span>
      <span className="astrocoins-badge-value">{astrocoins}</span>
    </div>
  );
}
