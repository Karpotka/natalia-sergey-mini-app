import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { shouldShowOnboarding } from '../lib/onboardingStorage';
import { OnboardingWizard } from './OnboardingWizard';

/** Один раз для нового пользователя (или нового VK-аккаунта на устройстве); после завершения / пропуска не показывается. */
export function OnboardingGate() {
  const { authMode, token } = useSession();
  const [visible, setVisible] = useState(() => shouldShowOnboarding());

  useEffect(() => {
    setVisible(shouldShowOnboarding());
  }, [authMode, token]);

  const onFinished = useCallback(() => {
    setVisible(false);
  }, []);

  if (!visible) return null;
  return <OnboardingWizard onFinished={onFinished} />;
}
