import { useCallback, useEffect, useState } from 'react';
import { isBackendEnabled } from '../api/config';
import { profileGet } from '../api/mysticApi';
import { useProfile } from '../context/ProfileContext';
import { useSession } from '../context/SessionContext';
import { markOnboardingDone, shouldShowOnboarding } from '../lib/onboardingStorage';
import {
  isOnboardingProfileSatisfied,
  isOnboardingProfileSatisfiedOnServer,
  profileFromApi,
} from '../lib/profileFromApi';
import { OnboardingWizard } from './OnboardingWizard';

/** Обязательный профиль (имя, дата, пол) при первом входе; отдельные ключи для VK и Telegram. */
export function OnboardingGate() {
  const { authMode, token } = useSession();
  const { profile, setProfile } = useProfile();
  const backendOn = isBackendEnabled();
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const evaluate = useCallback(async () => {
    setReady(false);

    if (isOnboardingProfileSatisfied(profile)) {
      markOnboardingDone();
      setVisible(false);
      setReady(true);
      return;
    }

    const hasSessionToken =
      Boolean(token) &&
      (authMode === 'vk_token' || authMode === 'tg_token' || authMode === 'dev_token');

    if (backendOn && hasSessionToken && token) {
      try {
        const data = await profileGet(token);
        const mapped = profileFromApi(data);
        if (isOnboardingProfileSatisfiedOnServer(data)) {
          setProfile(mapped);
          markOnboardingDone();
          setVisible(false);
          setReady(true);
          return;
        }
      } catch {
        /* локальный онбординг */
      }
    }

    setVisible(shouldShowOnboarding());
    setReady(true);
  }, [authMode, token, backendOn, profile, setProfile]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  if (!ready || !visible) return null;
  return <OnboardingWizard onFinished={() => setVisible(false)} />;
}
