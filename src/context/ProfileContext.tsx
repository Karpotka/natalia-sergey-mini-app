import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { profileStorageKey, readAccountStorageSuffix } from '../lib/accountScope';
import { useSession } from './SessionContext';

const LEGACY_PROFILE_KEY = 'natalia-sergey-user-profile';

export type UserGender = 'female' | 'male';

export type UserProfile = {
  name: string;
  birthDate: string;
  /** `HH:mm` в локальном формате для input type="time" */
  birthTime: string;
  birthPlace: string;
  gender: UserGender | '';
  /** Точное время рождения неизвестно — на сервер уходит `has_exact_time: false`, поле времени не обязательно. */
  birthTimeUnknown?: boolean;
};

const EMPTY: UserProfile = {
  name: '',
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  gender: '',
  birthTimeUnknown: false,
};

function parseProfileRaw(raw: string): UserProfile {
  const p = JSON.parse(raw) as Partial<UserProfile>;
  return {
    name: typeof p.name === 'string' ? p.name : '',
    birthDate: typeof p.birthDate === 'string' ? p.birthDate : '',
    birthTime: typeof p.birthTime === 'string' ? p.birthTime : '',
    birthPlace: typeof p.birthPlace === 'string' ? p.birthPlace : '',
    gender: p.gender === 'female' || p.gender === 'male' ? p.gender : '',
    birthTimeUnknown: p.birthTimeUnknown === true,
  };
}

function loadStored(): UserProfile {
  try {
    const key = profileStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw) {
      const suffix = readAccountStorageSuffix();
      if (suffix && !suffix.startsWith('_tg')) {
        const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
        if (legacy) {
          localStorage.setItem(key, legacy);
          raw = legacy;
        }
      }
    }
    if (!raw) return { ...EMPTY };
    return parseProfileRaw(raw);
  } catch {
    return { ...EMPTY };
  }
}

/** Дата не в будущем; время HH:mm или отмечено «точное время неизвестно». */
export function isProfileComplete(p: UserProfile): boolean {
  if (!p.name.trim()) return false;
  if (!p.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) return false;
  if (!p.birthTimeUnknown) {
    if (!p.birthTime || !/^\d{2}:\d{2}$/.test(p.birthTime)) return false;
  }
  if (!p.birthPlace.trim()) return false;
  if (p.gender !== 'female' && p.gender !== 'male') return false;

  const timePart = p.birthTimeUnknown ? '12:00' : p.birthTime;
  const birth = new Date(`${p.birthDate}T${timePart}:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (birth > todayEnd) return false;

  return true;
}

/** Достаточно для экрана гороскопа (календарь, луна, запрос к API): имя + дата рождения. Полный профиль для сервера — см. {@link isProfileComplete}. */
export function isHoroscopeEntryAllowed(p: UserProfile): boolean {
  if (!p.name.trim()) return false;
  if (!p.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) return false;
  const birth = new Date(`${p.birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (birth > todayEnd) return false;
  return true;
}

type ProfileContextValue = {
  profile: UserProfile;
  isComplete: boolean;
  setProfile: (next: UserProfile) => void;
  updateField: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { authMode, platform } = useSession();
  const [profile, setProfileState] = useState<UserProfile>(() =>
    typeof window !== 'undefined' ? loadStored() : { ...EMPTY },
  );

  useEffect(() => {
    if (authMode === 'idle') return;
    setProfileState(loadStored());
  }, [authMode, platform]);

  const persist = useCallback((next: UserProfile) => {
    try {
      localStorage.setItem(profileStorageKey(), JSON.stringify(next));
    } catch {
      /* */
    }
    setProfileState(next);
  }, []);

  const setProfile = useCallback((next: UserProfile) => {
    persist(next);
  }, [persist]);

  const updateField = useCallback(
    <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
      setProfileState((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(profileStorageKey(), JSON.stringify(next));
        } catch {
          /* */
        }
        return next;
      });
    },
    [],
  );

  const isComplete = useMemo(() => isProfileComplete(profile), [profile]);

  const value = useMemo(
    () => ({ profile, isComplete, setProfile, updateField }),
    [profile, isComplete, setProfile, updateField],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
