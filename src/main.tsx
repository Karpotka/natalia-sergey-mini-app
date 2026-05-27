import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ensureTelegramWebAppReady, loadTelegramSdk } from './telegram/telegramBootstrap';
import { ensureVkWebAppInit, isVkClientEnvironment } from './vk/vkBootstrap';
import './index.css';
import './styles/ecosystem.css';
import './styles/ui-kit.css';
import App from './App.tsx';

async function bootstrap() {
  if (isVkClientEnvironment()) {
    const vkInit = ensureVkWebAppInit();
    if (vkInit) await vkInit;
  } else {
    await loadTelegramSdk();
    ensureTelegramWebAppReady();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  );
}

void bootstrap();
