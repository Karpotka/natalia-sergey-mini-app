import { useCallback, useEffect, useState } from 'react';
import { useProfile, type UserGender } from '../context/ProfileContext';
import {
  markOnboardingDone,
  markOnboardingSkipped,
  writeOnboardingInterests,
  type OnboardingInterest,
} from '../lib/onboardingStorage';
import './onboarding.css';

type Props = {
  onFinished: () => void;
};

const INTEREST_ORDER: OnboardingInterest[] = ['moon', 'astrology', 'tarot', 'tarot_day', 'consultations'];

const INTEREST_META: Record<OnboardingInterest, { title: string; desc: string }> = {
  moon: {
    title: 'Луна',
    desc: 'Фазы и календарь.',
  },
  astrology: {
    title: 'Гороскоп',
    desc: 'Прогноз по дате рождения.',
  },
  tarot: {
    title: 'Таро-расклады',
    desc: 'Ситуации и отношения.',
  },
  tarot_day: {
    title: 'Карта дня',
    desc: 'Фокус на день.',
  },
  consultations: {
    title: 'Консультации',
    desc: 'Сессии с экспертом.',
  },
};

const WELCOME_PRODUCT_LINES = [
  'Луна и календарь',
  'Гороскоп по дате рождения',
  'Таро-расклады',
  'Карта дня',
  'Консультации',
] as const;

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
];

function MoonArt() {
  return (
    <div className="onboarding-moon-wrap" aria-hidden>
      <div className="onboarding-clouds" />
      <svg className="onboarding-moon-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="onb-moon-grad" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#fdf6e8" />
            <stop offset="45%" stopColor="#e8dcc8" />
            <stop offset="100%" stopColor="#9a8a6e" />
          </radialGradient>
        </defs>
        <circle cx="58" cy="56" r="46" fill="url(#onb-moon-grad)" />
        <circle cx="76" cy="50" r="40" fill="#070608" />
      </svg>
    </div>
  );
}

export function OnboardingWizard({ onFinished }: Props) {
  const { profile, setProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Set<OnboardingInterest>>(
    () => new Set<OnboardingInterest>(['moon', 'astrology']),
  );
  const [name, setName] = useState(() => profile.name);
  const [birthDate, setBirthDate] = useState(() => profile.birthDate);
  const [birthTime, setBirthTime] = useState(() => profile.birthTime);
  const [gender, setGender] = useState<UserGender | ''>(() => profile.gender || '');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goBack = useCallback(() => {
    setFormError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const persistInterestsAndNext = useCallback(() => {
    writeOnboardingInterests([...interests]);
    setStep(3);
  }, [interests]);

  const finish = useCallback(() => {
    setFormError(null);
    const n = name.trim();
    if (!n) {
      setFormError('Укажите, как к вам обращаться.');
      return;
    }
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setFormError('Выберите дату рождения.');
      return;
    }
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    const bd = new Date(`${birthDate}T12:00:00`);
    if (Number.isNaN(bd.getTime()) || bd > endToday) {
      setFormError('Дата рождения не может быть в будущем.');
      return;
    }
    if (gender !== 'female' && gender !== 'male') {
      setFormError('Выберите пол.');
      return;
    }
    const t = birthTime.trim();
    if (t && !/^\d{2}:\d{2}$/.test(t)) {
      setFormError('Время рождения укажите как ЧЧ:ММ или оставьте пустым.');
      return;
    }

    setProfile({
      ...profile,
      name: n,
      birthDate,
      birthTime: t,
      gender,
    });
    markOnboardingDone();
    onFinished();
  }, [birthDate, birthTime, gender, name, onFinished, profile, setProfile]);

  const toggleInterest = (id: OnboardingInterest) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const skip = useCallback(() => {
    markOnboardingSkipped();
    onFinished();
  }, [onFinished]);

  const dots = (
    <div className="onboarding-dots" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`onboarding-dot${step === i ? ' onboarding-dot--active' : ''}`} />
      ))}
    </div>
  );

  return (
    <div className="onboarding-root" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onboarding-inner">
        <div className="onboarding-topbar">
          {step > 0 ? (
            <button type="button" className="onboarding-back" onClick={goBack} aria-label="Назад">
              ‹
            </button>
          ) : (
            <span className="onboarding-topbar-spacer" aria-hidden />
          )}
          <button type="button" className="onboarding-skip" onClick={skip}>
            Пропустить
          </button>
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <div className="onboarding-hero-art">
              <MoonArt />
            </div>
            <h1 id="onb-title" className="onboarding-title">
              Звёзды и внутренние ответы
            </h1>
            <p className="onboarding-lead">Луна, гороскоп, таро и консультации — в одном месте.</p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn onboarding-btn--primary" onClick={() => setStep(1)}>
                Начать путь
              </button>
            </div>
            {dots}
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <h1 id="onb-title" className="onboarding-title">
              Ваш космический компас
            </h1>
            <p className="onboarding-lead">Самопознание, ответы и поддержка экспертов.</p>
            <ul className="onboarding-list">
              {WELCOME_PRODUCT_LINES.map((line) => (
                <li key={line}>
                  <span className="onboarding-list-icon" aria-hidden>
                    ✦
                  </span>
                  <p className="onboarding-list-text">{line}</p>
                </li>
              ))}
            </ul>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn onboarding-btn--primary" onClick={() => setStep(2)}>
                Далее
              </button>
            </div>
            {dots}
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h1 id="onb-title" className="onboarding-title">
              Что вам интересно?
            </h1>
            <p className="onboarding-lead">Выберите темы — подстроим подборку под вас.</p>
            <div className="onboarding-cards" role="group" aria-label="Интересы">
              {INTEREST_ORDER.map((id) => {
                const on = interests.has(id);
                const m = INTEREST_META[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={`onboarding-card${on ? ' onboarding-card--on' : ''}`}
                    onClick={() => toggleInterest(id)}
                    aria-pressed={on}
                  >
                    <div className="onboarding-card-main">
                      <h2 className="onboarding-card-title">{m.title}</h2>
                      <p className="onboarding-card-desc">{m.desc}</p>
                    </div>
                    <span className="onboarding-card-check" aria-hidden>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn onboarding-btn--primary" onClick={persistInterestsAndNext}>
                Далее
              </button>
            </div>
            {dots}
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h1 id="onb-title" className="onboarding-title">
              Немного о вас
            </h1>
            <p className="onboarding-lead">
              Для точных подсказок. Место рождения — позже в кабинете.
            </p>
            <div className="onboarding-form">
              <label className="onboarding-field">
                <span>Дата рождения</span>
                <input
                  className="onboarding-input"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  autoComplete="bday"
                />
              </label>
              <label className="onboarding-field">
                <span>Время рождения (необязательно)</span>
                <input
                  className="onboarding-input"
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                />
              </label>
              <p className="onboarding-hint">Время можно не указывать.</p>
              <label className="onboarding-field">
                <span>Ваше имя</span>
                <input
                  className="onboarding-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                />
              </label>
              <div className="onboarding-field">
                <span>Пол</span>
                <div className="onboarding-gender" role="group" aria-label="Пол">
                  {GENDER_OPTIONS.map((o) => (
                    <label key={o.value} className={gender === o.value ? 'is-on' : ''}>
                      <input
                        type="radio"
                        name="onb-gender"
                        value={o.value}
                        checked={gender === o.value}
                        onChange={() => setGender(o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              {formError ? (
                <p className="onboarding-error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn onboarding-btn--primary" onClick={finish}>
                Продолжить
              </button>
            </div>
            {dots}
          </div>
        )}
      </div>
    </div>
  );
}
