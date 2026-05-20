import { readAccountStorageSuffix, profileStorageKey } from './accountScope';
import { isOnboardingProfileSatisfied } from './profileFromApi';
import type { UserProfile } from '../context/ProfileContext';
import { readVkUserIdFromCachedLaunchParams } from '../vk/vkLaunchParams';

/** Исторический ключ до привязки к vk_user_id. */
const LEGACY_ONBOARDING_KEY = 'natalia-sergey-onboarding-v1';
const LEGACY_PROFILE_KEY = 'natalia-sergey-user-profile';

export type OnboardingInterest = 'moon' | 'astrology' | 'tarot' | 'tarot_day' | 'consultations';

function userSuffix(): string {
  return readAccountStorageSuffix();
}

/** Флаг «онбординг завершён / пропущен» — отдельно для каждого пользователя на устройстве. */
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

/** Перенос старого глобального флага на ключ с vk_user_id (один раз). */
function migrateLegacyOnboardingIfNeeded(): void {
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

function readScopedProfile(): UserProfile | null {
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

/**
 * Показать онбординг, пока не заполнены имя, дата рождения и пол (локально или на сервере).
 * «Пропустить» на вводных шагах не отменяет обязательный шаг профиля.
 */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  migrateLegacyOnboardingIfNeeded();

  const scoped = readScopedProfile();
  if (scoped && isOnboardingProfileSatisfied(scoped)) {
    markOnboardingDone();
    return false;
  }

  // Не подтягиваем глобальный legacy-профиль в Telegram — иначе чужой VK-профиль скрывает форму.
  const suffix = userSuffix();
  if (!suffix.startsWith('_tg') && !scoped) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_PROFILE_KEY);
      if (legacyRaw) {
        const p = JSON.parse(legacyRaw) as Partial<UserProfile>;
        if (isOnboardingProfileSatisfied({
          name: typeof p.name === 'string' ? p.name : '',
          birthDate: typeof p.birthDate === 'string' ? p.birthDate : '',
          gender: p.gender === 'female' || p.gender === 'male' ? p.gender : '',
        })) {
          return false;
        }
      }
    } catch {
      /* */
    }
  }

  return true;
}
