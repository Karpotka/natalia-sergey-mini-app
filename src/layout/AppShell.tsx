import { useLayoutEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { APP_BACKGROUND_URL, appBackgroundShellStyle } from '../assets/appBackground';
import { ApiStatusBanner } from '../components/ApiStatusBanner';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { readProductPanel } from './ProductPager';

export function AppShell() {
  const [search] = useSearchParams();
  const panel = readProductPanel(search);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-bg-image', `url("${APP_BACKGROUND_URL}")`);
    root.classList.add('app-has-celestial-bg');
    return () => {
      root.style.removeProperty('--app-bg-image');
      root.classList.remove('app-has-celestial-bg');
    };
  }, []);

  return (
    <div
      className="shell shell--products shell--celestial-bg"
      style={appBackgroundShellStyle()}
      data-shell-panel={panel}
    >
      <header className="shell-header shell-header--compact">
        <div className="shell-header-bar">
          <h1 className="shell-brand">ASTRO VESPER</h1>
        </div>
      </header>
      <ApiStatusBanner />
      <div className="shell-main">
        <Outlet />
      </div>
      {panel === 'profile' && <LegalDisclaimer />}
    </div>
  );
}
