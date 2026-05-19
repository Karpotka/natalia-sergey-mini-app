import { readVkUserIdFromCachedLaunchParams } from '../vk/vkLaunchParams';

/** Исторический ключ до привязки к vk_user_id. */
const LEGACY_ONBOARDING_KEY = 'natalia-sergey-onboarding-v1';
const PROFILE_STORAGE = 'natalia-sergey-user-profile';

export type OnboardingInterest = 'moon' | 'astrology' | 'tarot' | 'tarot_day' | 'consultations';

function vkUserSuffix(): string {
  const uid = readVkUserIdFromCachedLaunchParams();
  return uid ? `_u${uid}` : '';
}

/** Флаг «онбординг завершён / пропущен» — отдельно для каждого VK-пользователя на устройстве. */
function onboardingFlagKey(): string {
  return `${LEGACY_ONBOARDING_KEY}${vkUserSuffix()}`;
}

const LEGACY_INTERESTS_KEY = 'natalia-sergey-onboarding-interests';

function interestsStorageKey(): string {
  return `${LEGACY_INTERESTS_KEY}${vkUserSuffix()}`;
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
 * Показать онбординг один раз: нет флага done/skipped для этого пользователя (или общий legacy-ключ).
 * Если в локальном профиле уже есть имя и дата рождения — считаем пользователя «не новым» и не показываем.
 */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  migrateLegacyOnboardingIfNeeded();
  const key = onboardingFlagKey();
  const flag = localStorage.getItem(key);
  if (flag === 'done' || flag === 'skipped') return false;

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE);
    if (raw) {
      const p = JSON.parse(raw) as { name?: string; birthDate?: string };
      const nameOk = typeof p.name === 'string' && p.name.trim().length > 0;
      const dateOk = typeof p.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate);
      if (nameOk && dateOk) {
        localStorage.setItem(key, 'done');
        return false;
      }
    }
  } catch {
    /* */
  }
  return true;
}
