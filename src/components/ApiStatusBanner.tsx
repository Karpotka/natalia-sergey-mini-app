import { useSession } from '../context/SessionContext';

export function ApiStatusBanner() {
  const { authMessage, authMode, backendEnabled } = useSession();

  if (!backendEnabled) {
    return (
      <div className="api-banner" role="status">
        Сервер недоступен. Откройте приложение во ВКонтакте.{' '}
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
