import { readAccountStorageSuffix, profileStorageKey } from './accountScope';
import { isOnboardingProfileSatisfied } from './profileFromApi';
import type { UserProfile } from '../context/ProfileContext';
import { readVkUserIdFromCachedLaunchParams } from '../vk/vkLaunchParams';

/** Исторический ключ до привязки к vk_user_id. */
const LEGACY_ONBOARDING_KEY = 'natalia-sergey-onboarding-v1';
export type OnboardingInterest = 'moon' | 'astrology' | 'tarot' | 'tarot_day' | 'consultations';

function userSuffix(): string {
  return readAccountStorageSuffix();
}

/** Флаг «онбординг завершён» — отдельно для каждого пользователя на устройстве. */
function onboardingFlagKey(): string {
  return `${LEGACY_ONBOARDING_KEY}${userSuffix()}`;
}

const LEGACY_INTERESTS_KEY = 'natalia-sergey-onboarding-interests';

function interestsStorageKey(): string {
  return `${LEGACY_INTERESTS_KEY}${userSuffix()}`;
}

function migrateLegacyInterestsIfNeeded(): void {
  const uid = readVkUserIdFromCachedLaunchParams();
  if (!uid) return;
  try {
    const scoped = interestsStorageKey();
    if (localStorage.getItem(scoped)) return;
    const legacy = localStorage.getItem(LEGACY_INTERESTS_KEY);
    if (legacy) {
      localStorage.setItem(scoped, legacy);
      localStorage.removeItem(LEGACY_INTERESTS_KEY);
    }
  } catch {
    /* */
  }
}

/** Перенос старого глобального флага на ключ с vk_user_id (один раз). В Telegram не переносим — иначе новый TG-юзер унаследует «done». */
function migrateLegacyOnboardingIfNeeded(): void {
  const suffix = userSuffix();
  if (suffix.startsWith('_tg')) return;
  const uid = readVkUserIdFromCachedLaunchParams();
  if (!uid) return;
  try {
    const scoped = onboardingFlagKey();
    if (localStorage.getItem(scoped)) return;
    const legacy = localStorage.getItem(LEGACY_ONBOARDING_KEY);
    if (legacy === 'done' || legacy === 'skipped') {
      localStorage.setItem(scoped, legacy);
      localStorage.removeItem(LEGACY_ONBOARDING_KEY);
    }
  } catch {
    /* */
  }
}

/** Локальный профиль текущего пользователя (scoped key). */
export function readScopedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(profileStorageKey());
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      birthDate: typeof p.birthDate === 'string' ? p.birthDate : '',
      birthTime: typeof p.birthTime === 'string' ? p.birthTime : '',
      birthPlace: typeof p.birthPlace === 'string' ? p.birthPlace : '',
      gender: p.gender === 'female' || p.gender === 'male' ? p.gender : '',
      birthTimeUnknown: p.birthTimeUnknown === true,
    };
  } catch {
    return null;
  }
}

export function readOnboardingInterests(): OnboardingInterest[] {
  try {
    migrateLegacyOnboardingIfNeeded();
    migrateLegacyInterestsIfNeeded();
    const raw = localStorage.getItem(interestsStorageKey());
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    const allowed: OnboardingInterest[] = ['moon', 'astrology', 'tarot', 'tarot_day', 'consultations'];
    return a.filter((x): x is OnboardingInterest => typeof x === 'string' && allowed.includes(x as OnboardingInterest));
  } catch {
    return [];
  }
}

export function writeOnboardingInterests(next: OnboardingInterest[]) {
  try {
    localStorage.setItem(interestsStorageKey(), JSON.stringify(next));
  } catch {
    /* */
  }
}

export function markOnboardingDone() {
  try {
    migrateLegacyOnboardingIfNeeded();
    localStorage.setItem(onboardingFlagKey(), 'done');
  } catch {
    /* */
  }
}

export function markOnboardingSkipped() {
  try {
    migrateLegacyOnboardingIfNeeded();
    localStorage.setItem(onboardingFlagKey(), 'skipped');
  } catch {
    /* */
  }
}

export function readOnboardingFlag(): string | null {
  try {
    migrateLegacyOnboardingIfNeeded();
    return localStorage.getItem(onboardingFlagKey());
  } catch {
    return null;
  }
}

/**
 * Нужен ли обязательный мастер профиля: нет имени/даты/пола в scoped-профиле.
 * Глобальный legacy «done» без профиля этого пользователя не скрывает форму.
 */
export function needsOnboardingWizard(): boolean {
  if (typeof window === 'undefined') return false;

  if (readOnboardingFlag() === 'done') {
    return false;
  }

  const scoped = readScopedProfile();
  if (!scoped || !isOnboardingProfileSatisfied(scoped)) {
    return true;
  }

  // Профиль в localStorage полный, но мастер не завершён — всё равно показываем.
  return true;
}

/** @deprecated используйте needsOnboardingWizard */
export function shouldShowOnboarding(): boolean {
  return needsOnboardingWizard();
}
