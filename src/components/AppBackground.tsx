import { APP_BACKGROUND_PUBLIC_URL, APP_BACKGROUND_URL } from '../assets/appBackground';
import '../styles/app-background.css';

type Props = {
  /** center top — главная; center 28% — landscape */
  position?: 'top' | 'landscape';
  /** fixed — под всем приложением; contained — внутри полноэкранной луны (portal) */
  variant?: 'fixed' | 'contained';
};

/**
 * Фоновая картинка слоем <img>: в iOS/VK WebView надёжнее, чем background-image + CSS-переменные.
 */
export function AppBackground({ position = 'top', variant = 'fixed' }: Props) {
  const src = APP_BACKGROUND_URL || APP_BACKGROUND_PUBLIC_URL;

  return (
    <img
      className={`app-bg-image app-bg-image--${position} app-bg-image--${variant}`}
      src={src}
      alt=""
      aria-hidden
      decoding="async"
      fetchPriority="low"
    />
  );
}
