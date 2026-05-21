import { useEffect, useState } from 'react';
import { isBackendEnabled } from '../api/config';
import { profileGet } from '../api/mysticApi';
import { useProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import { markOnboardingDone, needsOnboardingWizard } from '../lib/onboardingStorage';
import {
  isOnboardingProfileSatisfiedOnServer,
  profileFromApi,
} from '../lib/profileFromApi';
import { useAccountStorageKey } from '../lib/useAccountStorageKey';
import { OnboardingWizard } from './OnboardingWizard';

/** Обязательный профиль при первом входе; скрываем только после подтверждения на сервере или явного завершения мастера. */
export function OnboardingGate() {
  const { authMode, token } = useSession();
  const { setProfile } = useProfile();
  const storageKey = useAccountStorageKey();
  const backendOn = isBackendEnabled();
  const [visible, setVisible] = useState(() => needsOnboardingWizard());

  useEffect(() => {
    if (needsOnboardingWizard()) {
      setVisible(true);
    } else {
      setVisible(false);
      return;
    }

    const hasSessionToken =
      Boolean(token) &&
      (authMode === 'vk_token' || authMode === 'tg_token' || authMode === 'dev_token');

    if (!backendOn || !hasSessionToken || !token) {
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
  }, [authMode, token, backendOn, storageKey, setProfile]);

  if (!visible) return null;
  return <OnboardingWizard onFinished={() => setVisible(false)} />;
}
