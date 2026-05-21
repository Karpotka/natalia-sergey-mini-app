import { useEffect, useState } from 'react';
import { isBackendEnabled } from '../api/config';
import { profileGet } from '../api/mysticApi';
import { useProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import {
  markOnboardingDone,
  needsOnboardingWizard,
  readOnboardingFlag,
} from '../lib/onboardingStorage';
import {
  isOnboardingProfileSatisfiedOnServer,
  profileFromApi,
} from '../lib/profileFromApi';
import { useAccountStorageKey } from '../lib/useAccountStorageKey';
import { OnboardingWizard } from './OnboardingWizard';

function hasApiSession(authMode: string, token: string | null): boolean {
  return (
    Boolean(token) &&
    (authMode === 'vk_token' || authMode === 'tg_token' || authMode === 'dev_token')
  );
}

/**
 * Обязательный профиль при первом входе.
 * Новый пользователь (newUserCreated) — всегда мастер до markOnboardingDone, даже если бэк отдал «пустой» профиль с дефолтами.
 */
export function OnboardingGate() {
  const { authMode, token, newUserCreated, authReady } = useSession();
  const { setProfile } = useProfile();
  const storageKey = useAccountStorageKey();
  const backendOn = isBackendEnabled();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!authReady) {
      setVisible(needsOnboardingWizard() || newUserCreated === true);
      return;
    }

    const wizardDone = readOnboardingFlag() === 'done';

    if (newUserCreated === true) {
      setVisible(!wizardDone);
      return;
    }

    if (!needsOnboardingWizard()) {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (!backendOn || !hasApiSession(authMode, token) || !token) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await profileGet(token);
        if (cancelled) return;
        if (isOnboardingProfileSatisfiedOnServer(data)) {
          setProfile(profileFromApi(data));
          markOnboardingDone();
          setVisible(false);
        } else {
          setVisible(true);
        }
      } catch {
        if (!cancelled) setVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authMode, token, backendOn, storageKey, setProfile, newUserCreated, authReady]);

  if (!visible) return null;
  return <OnboardingWizard onFinished={() => setVisible(false)} />;
}
