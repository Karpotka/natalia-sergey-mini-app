import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { isBackendEnabled, readDevBearer } from '../api/config';
import { initUserDailyRune, profileGet, vkMiniAppInit, type InitUserResponse, type VkInitResponse } from '../api/mysticApi';
import { pickWalletAstrocoinBalance } from '../lib/astrocoinsBalance';
import { ensureVkWebAppInit } from '../vk/vkBootstrap';
import {
  collectVkLaunchParams,
  hasVkAuthLaunchParams,
  readVkReferralFromLaunchParams,
} from '../vk/vkLaunchParams';

function readEquipBackgroundId(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const equip = (raw as Record<string, unknown>).equip;
  if (!equip || typeof equip !== 'object') return null;
  const bg = (equip as Record<string, unknown>).background;
  if (typeof bg === 'number' && bg > 0) return bg;
  return null;
}

function tokenFromRecord(o: Record<string, unknown>): string | null {
  const direct =
    o.token ?? o.access_token ?? o.accessToken ?? o.jwt ?? o.bearer_token ?? o.bearerToken;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  return null;
}

function extractVkInitToken(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.allow === false) return null;

  const top = tokenFromRecord(o);
  if (top) return top;

  const nestedKeys = ['data', 'result', 'body', 'payload', 'user'] as const;
  for (const k of nestedKeys) {
    const nested = o[k];
    if (nested && typeof nested === 'object') {
      const t = tokenFromRecord(nested as Record<string, unknown>);
      if (t) return t;
    }
  }
  return null;
}

type AuthMode = 'idle' | 'preview' | 'dev_token' | 'vk_token' | 'vk_no_backend';

type SessionValue = {
  token: string | null;
  authMode: AuthMode;
  authMessage: string | null;
  /** false — только UI, без запросов к API (см. VITE_ENABLE_BACKEND). */
  backendEnabled: boolean;
  /**
   * Баланс астрокоинов (в API — в основном `score_crystal` при входе; не путать с полем `crystal` в Таро = цена).
   * `null` — неизвестно (нет сессии, режим превью или отладка без ответа init).
   */
  astrocoins: number | null;
  /** Обновить баланс из ответа, если в нём есть явные поля счёта (`score_crystal` и т.д.). */
  applyAstrocoinsFromResponse: (raw: unknown) => void;
  /** Подтянуть баланс из `GET /profile` (после покупок на других вкладках). */
  refreshAstrocoinsFromProfile: () => Promise<void>;
  refreshInit: () => Promise<void>;
  /** ID надетой обложки рубашки Таро из `equip.background` (POST /vk/init и др.). */
  equippedTarotBackgroundId: number | null;
  setEquippedTarotBackgroundId: (id: number | null) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('idle');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
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
      /* баланс обновится при следующем init */
    }
  }, [backendEnabled, token, applyAstrocoinsFromResponse]);

  const refreshInit = useCallback(async () => {
    if (!backendEnabled) {
      setToken(null);
      setAstrocoins(null);
      setEquippedTarotBackgroundId(null);
      setAuthMode('preview');
      setAuthMessage(null);
      return;
    }

    const dev = readDevBearer();
    if (dev) {
      setToken(dev);
      setAstrocoins(null);
      setEquippedTarotBackgroundId(null);
      setAuthMode('dev_token');
      setAuthMessage('Режим отладки: используется VITE_DEV_BEARER_TOKEN.');
      return;
    }

    setToken(null);
    setAstrocoins(null);
    setEquippedTarotBackgroundId(null);
    setAuthMessage(null);
    setAuthMode('idle');

    try {
      const p = ensureVkWebAppInit();
      if (p) await p;
    } catch {
      /* */
    }

    const launch = await collectVkLaunchParams();
    if (!hasVkAuthLaunchParams(launch)) {
      setEquippedTarotBackgroundId(null);
      setAuthMode('vk_no_backend');
      setAuthMessage(null);
      return;
    }

    const referral = readVkReferralFromLaunchParams(launch);

    try {
      let data: InitUserResponse | VkInitResponse;
      try {
        data = await vkMiniAppInit(launch, referral);
      } catch (eVk) {
        try {
          data = await initUserDailyRune(launch, null, referral);
        } catch (eRune) {
          const a =
            eVk instanceof ApiError ? `${eVk.code}: ${eVk.message}` : eVk instanceof Error ? eVk.message : String(eVk);
          const b =
            eRune instanceof ApiError
              ? `${eRune.code}: ${eRune.message}`
              : eRune instanceof Error
                ? eRune.message
                : String(eRune);
          throw new Error(`${a} | запасной init: ${b}`);
        }
      }

      const jwt = extractVkInitToken(data);
      if (jwt) {
        setToken(jwt);
        setAuthMode('vk_token');
        setAuthMessage(null);
        const bal = pickWalletAstrocoinBalance(data);
        setAstrocoins(bal !== undefined ? bal : null);
        setEquippedTarotBackgroundId(readEquipBackgroundId(data));
        return;
      }
      setEquippedTarotBackgroundId(null);
      setAuthMode('vk_no_backend');
      setAuthMessage(
        'VK: в ответе нет JWT (проверьте тело ответа /vk/init или /initUserDailyRuneHandler в Swagger).',
      );
    } catch (e) {
      setEquippedTarotBackgroundId(null);
      setAuthMode('vk_no_backend');
      const msg =
        e instanceof ApiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
      setAuthMessage(
        `Вход не удался (сначала POST /vk/init, затем POST /initUserDailyRuneHandler): ${msg}`,
      );
    }
  }, [backendEnabled]);

  useEffect(() => {
    void refreshInit();
  }, [refreshInit]);

  const value = useMemo(
    () => ({
      token,
      authMode,
      authMessage,
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
