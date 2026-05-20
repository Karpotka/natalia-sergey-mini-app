import { ApiError } from '../api/client';
import { profileAddParam, profileChangeParam, type ProfileAddParamBody, type ProfileSex } from '../api/mysticApi';
import type { UserProfile } from '../context/ProfileContext';

function birthTimeToApi(birthTime: string, hasExact: boolean): string | null {
  if (!hasExact) return null;
  const t = birthTime.trim();
  if (!t) return null;
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  return t;
}

/** Сохранить данные с последнего шага онбординга на бэкенд. */
export async function persistOnboardingProfileToServer(profile: UserProfile, token: string): Promise<void> {
  const sex: ProfileSex | null =
    profile.gender === 'female' || profile.gender === 'male' ? profile.gender : null;
  if (!sex) throw new Error('profile_sex_required');

  const hasExact = Boolean(profile.birthTime.trim());
  const body: ProfileAddParamBody = {
    name: profile.name.trim(),
    sex,
    birth_date: profile.birthDate,
    birth_time_str: birthTimeToApi(profile.birthTime, hasExact),
    has_exact_time: hasExact,
    place_name: profile.birthPlace.trim(),
    tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
  };

  try {
    await profileAddParam(body, token);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status >= 500)) {
      await profileChangeParam(body, token);
      return;
    }
    throw e;
  }
}
