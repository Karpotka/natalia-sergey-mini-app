import { useSession } from '../context/SessionContext';
import { BACKEND_UNAVAILABLE } from '../lib/userFacingCopy';

export function ApiStatusBanner() {
  const { authMessage, authMode, backendEnabled } = useSession();

  if (!backendEnabled) {
    return (
      <div className="api-banner" role="status">
        {BACKEND_UNAVAILABLE}{' '}
        <a href="https://serg.srvmysticode.ru/docs/#/" target="_blank" rel="noreferrer">
          Документация API
        </a>
      </div>
    );
  }

  if ((authMode === 'auth_failed' || authMode === 'vk_no_backend') && authMessage) {
    return (
      <div className="api-banner" role="status">
        {authMessage}
      </div>
    );
  }

  return null;
}
