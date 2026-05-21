import { useEffect, useState } from 'react';
import { profileStorageKey } from './accountScope';
import { useSession } from '../context/SessionContext';

/** Перечитывает ключ localStorage, когда появился telegram user id в initData. */
export function useAccountStorageKey(): string {
  const { authMode, platform } = useSession();
  const [key, setKey] = useState(() => profileStorageKey());

  useEffect(() => {
    setKey(profileStorageKey());
    const id = window.setInterval(() => {
      const next = profileStorageKey();
      setKey((prev) => (prev === next ? prev : next));
    }, 250);
    return () => window.clearInterval(id);
  }, [authMode, platform]);

  return key;
}
