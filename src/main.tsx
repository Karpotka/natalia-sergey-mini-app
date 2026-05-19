import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ensureTelegramWebAppReady } from './telegram/telegramBootstrap';
import { ensureVkWebAppInit } from './vk/vkBootstrap';
import './index.css';
import './styles/ecosystem.css';
import './styles/ui-kit.css';
import App from './App.tsx';

ensureTelegramWebAppReady();
void ensureVkWebAppInit();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
