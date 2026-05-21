import type { ProfileApiModel } from '../api/mysticApi';
import type { UserProfile } from '../context/ProfileContext';

function readBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return undefined;
}

export function profileFromApi(p: ProfileApiModel): UserProfile {
  const sex = p.sex === 'female' || p.sex === 'male' ? p.sex : '';
  const rawTime = typeof p.birth_time === 'string' ? p.birth_time.trim() : '';
  const hasExact = readBool(p.has_exact_time) === true;
  const birthTimeUnknown = !hasExact;
  const birthTime =
    hasExact && rawTime.length >= 5 && /^\d{2}:\d{2}/.test(rawTime) ? rawTime.slice(0, 5) : '';
  return {
    name: typeof p.name === 'string' ? p.name : '',
    birthDate: typeof p.birth_date === 'string' ? p.birth_date : '',
    birthTime,
    birthPlace: typeof p.place_name === 'string' ? p.place_name : '',
    gender: sex,
    birthTimeUnknown,
  };
}

/** Минимум после онбординга: имя, дата рождения, пол (как в последнем шаге мастера). */
export function isOnboardingProfileSatisfied(
  p: Pick<UserProfile, 'name' | 'birthDate' | 'gender'>,
): boolean {
  if (!p.name.trim()) return false;
  if (!p.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) return false;
  if (p.gender !== 'female' && p.gender !== 'male') return false;
  const birth = new Date(`${p.birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (birth > todayEnd) return false;
  return true;
}

export function isOnboardingProfileSatisfiedOnServer(data: ProfileApiModel): boolean {
  const mapped = profileFromApi(data);
  if (!isOnboardingProfileSatisfied(mapped)) return false;
  const hasBirth = Boolean(data.birth_date && String(data.birth_date).trim());
  const hasSex = data.sex === 'female' || data.sex === 'male';
  return hasBirth && hasSex;
}
