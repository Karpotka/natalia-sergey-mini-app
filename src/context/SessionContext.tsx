import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { isBackendEnabled, readDevBearer } from '../api/config';
import { initUserDailyRune, profileGet, vkMiniAppInit, type InitUserResponse, type VkInitResponse } from '../api/mysticApi';
import { pickWalletAstrocoinBalance } from '../lib/astrocoinsBalance';
import { detectAppPlatform, type AppPlatform } from '../platform/detectPlatform';
import { extractInitJwt, initResponseDenied, readEquipBackgroundId } from '../session/authHelpers';
import {
  AUTH_NO_JWT,
  AUTH_OPEN_FROM_APP,
  authFailedMessage,
} from '../lib/userFacingCopy';
import {
  ensureTelegramWebAppReady,
  hasTelegramAuthInitData,
  readTelegramInitData,
  readTelegramReferralParam,
} from '../telegram/telegramBootstrap';
import { ensureVkWebAppInit } from '../vk/vkBootstrap';
import {
  collectVkLaunchParams,
  hasVkAuthLaunchParams,
  readVkReferralFromLaunchParams,
} from '../vk/vkLaunchParams';

type AuthMode =
  | 'idle'
  | 'preview'
  | 'dev_token'
  | 'vk_token'
  | 'tg_token'
  /** @deprecated используйте auth_failed */
  | 'vk_no_backend'
  | 'auth_failed';

type SessionValue = {
  token: string | null;
  authMode: AuthMode;
  authMessage: string | null;
  platform: AppPlatform | null;
  backendEnabled: boolean;
  astrocoins: number | null;
  applyAstrocoinsFromResponse: (raw: unknown) => void;
  refreshAstrocoinsFromProfile: () => Promise<void>;
  refreshInit: () => Promise<void>;
  equippedTarotBackgroundId: number | null;
  setEquippedTarotBackgroundId: (id: number | null) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

function applyInitSuccess(
  data: InitUserResponse | VkInitResponse,
  setters: {
    setToken: (t: string) => void;
    setAuthMode: (m: AuthMode) => void;
    setAuthMessage: (m: string | null) => void;
    setAstrocoins: (n: number | null) => void;
    setEquippedTarotBackgroundId: (id: number | null) => void;
  },
  authMode: 'vk_token' | 'tg_token',
): boolean {
  if (initResponseDenied(data)) {
    setters.setEquippedTarotBackgroundId(null);
    setters.setAuthMode('auth_failed');
    setters.setAuthMessage('Доступ к приложению временно ограничен (maintenance).');
    return false;
  }
  const jwt = extractInitJwt(data);
  if (!jwt) return false;
  setters.setToken(jwt);
  setters.setAuthMode(authMode);
  setters.setAuthMessage(null);
  const bal = pickWalletAstrocoinBalance(data);
  setters.setAstrocoins(bal !== undefined ? bal : null);
  setters.setEquippedTarotBackgroundId(readEquipBackgroundId(data));
  return true;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('idle');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [platform, setPlatform] = useState<AppPlatform | null>(null);
  const [astrocoins, setAstrocoins] = useState<number | null>(null);
  const [equippedTarotBackgroundId, setEquippedTarotBackgroundId] = useState<number | null>(null);

  const backendEnabled = isBackendEnabled();

  const applyAstrocoinsFromResponse = useCallback((raw: unknown) => {
    const n = pickWalletAstrocoinBalance(raw);
    if (n !== undefined) setAstrocoins(n);
  }, []);

  const refreshAstrocoinsFromProfile = useCallback(async () => {
    if (!backendEnabled) return;
    const t = token ?? readDevBearer();
    if (!t) return;
    try {
      const p = await profileGet(t);
      applyAstrocoinsFromResponse(p);
    } catch {
      /* */
    }
  }, [backendEnabled, token, applyAstrocoinsFromResponse]);

  const refreshInit = useCallback(async () => {
    if (!backendEnabled) {
      setToken(null);
      setAstrocoins(null);
      setEquippedTarotBackgroundId(null);
      setPlatform(null);
      setAuthMode('preview');
      setAuthMessage(null);
      return;
    }

    const dev = readDevBearer();
    if (dev) {
      setToken(dev);
      setAstrocoins(null);
      setEquippedTarotBackgroundId(null);
      setPlatform(null);
      setAuthMode('dev_token');
      setAuthMessage('Режим отладки: используется VITE_DEV_BEARER_TOKEN.');
      return;
    }

    setToken(null);
    setAstrocoins(null);
    setEquippedTarotBackgroundId(null);
    setAuthMessage(null);
    setAuthMode('idle');

    const detected = detectAppPlatform();
    setPlatform(detected);

    const setters = {
      setToken,
      setAuthMode,
      setAuthMessage,
      setAstrocoins,
      setEquippedTarotBackgroundId,
    };

    if (detected === 'telegram') {
      ensureTelegramWebAppReady();
      const initData = readTelegramInitData();
      if (!hasTelegramAuthInitData() || !initData) {
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        setAuthMessage(AUTH_OPEN_FROM_APP);
        return;
      }

      try {
        const data = await initUserDailyRune(initData, null, readTelegramReferralParam());
        if (
          applyInitSuccess(data, setters, 'tg_token')
        ) {
          return;
        }
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        setAuthMessage(AUTH_NO_JWT);
      } catch (e) {
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        const msg =
          e instanceof ApiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
        setAuthMessage(authFailedMessage(msg));
      }
      return;
    }

    if (detected === 'vk') {
      try {
        const p = ensureVkWebAppInit();
        if (p) await p;
      } catch {
        /* */
      }

      const launch = await collectVkLaunchParams();
      if (!hasVkAuthLaunchParams(launch)) {
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        setAuthMessage(null);
        return;
      }

      const referral = readVkReferralFromLaunchParams(launch);

      try {
        const data = await vkMiniAppInit(launch, referral);
        if (applyInitSuccess(data, setters, 'vk_token')) return;
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        setAuthMessage(AUTH_NO_JWT);
      } catch (e) {
        setEquippedTarotBackgroundId(null);
        setAuthMode('auth_failed');
        const msg =
          e instanceof ApiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
        setAuthMessage(authFailedMessage(msg));
      }
      return;
    }

    setEquippedTarotBackgroundId(null);
    setAuthMode('auth_failed');
    setAuthMessage(null);
  }, [backendEnabled]);

  useEffect(() => {
    void refreshInit();
  }, [refreshInit]);

  const value = useMemo(
    () => ({
      token,
      authMode,
      authMessage,
      platform,
      backendEnabled,
      astrocoins,
      applyAstrocoinsFromResponse,
      refreshAstrocoinsFromProfile,
      refreshInit,
      equippedTarotBackgroundId,
      setEquippedTarotBackgroundId,
    }),
    [
      token,
      authMode,
      authMessage,
      platform,
      backendEnabled,
      astrocoins,
      applyAstrocoinsFromResponse,
      refreshAstrocoinsFromProfile,
      refreshInit,
      equippedTarotBackgroundId,
      setEquippedTarotBackgroundId,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** Есть Bearer для API (включая dev_token). */
export function hasApiSession(authMode: AuthMode, token: string | null): boolean {
  return Boolean(token) || authMode === 'dev_token';
}
