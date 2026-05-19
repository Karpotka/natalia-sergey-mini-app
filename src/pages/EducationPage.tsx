/** Раздел «Обучение» — астрология, Таро, Луна: лекции, тесты, подписка, подсказки при ошибке. */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ASTROLOGY_COURSE,
  ASTROLOGY_FREE_SECTION_COUNT,
} from '../features/education/astrologyCourse';
import { MOON_COURSE, MOON_FREE_SECTION_COUNT } from '../features/education/moonCourse';
import { TAROT_COURSE, TAROT_FREE_SECTION_COUNT } from '../features/education/tarotCourse';

const EDU_PROGRAMS: {
  id: CourseId;
  theme: 'astro' | 'tarot' | 'moon';
  icon: string;
  title: string;
  desc: string;
  sections: number;
  freeSections: number;
}[] = [
  {
    id: 'astro',
    theme: 'astro',
    icon: '✶',
    title: 'Астрология: полная лекция',
    desc: 'От определения астрологии до заключения: лекция по разделам и два проверочных вопроса после каждого. Часть курса бесплатно, продолжение — по подписке.',
    sections: ASTROLOGY_COURSE.length,
    freeSections: ASTROLOGY_FREE_SECTION_COUNT,
  },
  {
    id: 'tarot',
    theme: 'tarot',
    icon: '',
    title: 'Таро: полная лекция',
    desc: 'От основ Таро до практики и выводов: девять разделов, подсказки при ошибке в тестах. Часть курса бесплатно, дальше — по подписке.',
    sections: TAROT_COURSE.length,
    freeSections: TAROT_FREE_SECTION_COUNT,
  },
  {
    id: 'moon',
    theme: 'moon',
    icon: '🌙',
    title: 'Луна и ритмы: полная лекция',
    desc: '«Наука Луны», фазы, практика и кейсы: десять разделов с вопросами после каждого. Около 40% курса бесплатно, дальше — по подписке.',
    sections: MOON_COURSE.length,
    freeSections: MOON_FREE_SECTION_COUNT,
  },
];

export type CourseId = 'astro' | 'tarot' | 'moon';

const STORAGE = {
  astro: 'natalia_edu_astrology_full',
  tarot: 'natalia_edu_tarot_full',
  moon: 'natalia_edu_moon_full',
} as const;

type CourseSection =
  | (typeof ASTROLOGY_COURSE)[number]
  | (typeof TAROT_COURSE)[number]
  | (typeof MOON_COURSE)[number];

function getCourse(courseId: CourseId): CourseSection[] {
  if (courseId === 'astro') return ASTROLOGY_COURSE as CourseSection[];
  if (courseId === 'tarot') return TAROT_COURSE as CourseSection[];
  return MOON_COURSE as CourseSection[];
}

function getFreeCount(courseId: CourseId): number {
  if (courseId === 'astro') return ASTROLOGY_FREE_SECTION_COUNT;
  if (courseId === 'tarot') return TAROT_FREE_SECTION_COUNT;
  return MOON_FREE_SECTION_COUNT;
}

function readHasFullAccess(courseId: CourseId): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE[courseId]) === '1';
  } catch {
    return false;
  }
}

function writeFullAccess(courseId: CourseId, value: boolean): void {
  try {
    if (value) globalThis.localStorage?.setItem(STORAGE[courseId], '1');
    else globalThis.localStorage?.removeItem(STORAGE[courseId]);
  } catch {
    /* ignore */
  }
}

type Flow =
  | { kind: 'list' }
  | { kind: 'lesson'; courseId: CourseId; sectionIndex: number }
  | { kind: 'quiz'; courseId: CourseId; sectionIndex: number; questionIndex: 0 | 1 }
  | { kind: 'paywall'; courseId: CourseId }
  | { kind: 'done'; courseId: CourseId };

export function EducationPage() {
  const navigate = useNavigate();
  const [flow, setFlow] = useState<Flow>({ kind: 'list' });
  const [quizWrongHint, setQuizWrongHint] = useState<string | null>(null);

  const totalSections =
    flow.kind === 'lesson' || flow.kind === 'quiz' ? getCourse(flow.courseId).length : 0;

  const progressPercent = useMemo(() => {
    if (flow.kind === 'list' || flow.kind === 'done') return 0;
    if (flow.kind === 'paywall') {
      const n = getFreeCount(flow.courseId);
      const t = getCourse(flow.courseId).length;
      return Math.round((n / t) * 100);
    }
    if (flow.kind === 'lesson' || flow.kind === 'quiz') {
      const t = getCourse(flow.courseId).length;
      const base = flow.sectionIndex;
      const step =
        flow.kind === 'lesson' ? 0 : flow.questionIndex === 0 ? 0.33 : 0.66;
      return Math.min(100, Math.round(((base + step) / t) * 100));
    }
    return 0;
  }, [flow]);

  const openCourse = useCallback((id: CourseId) => {
    setQuizWrongHint(null);
    setFlow({ kind: 'lesson', courseId: id, sectionIndex: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const backToList = useCallback(() => {
    setQuizWrongHint(null);
    setFlow({ kind: 'list' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const section: CourseSection | undefined =
    flow.kind === 'lesson' || flow.kind === 'quiz' ? getCourse(flow.courseId)[flow.sectionIndex] : undefined;

  const goNextAfterLesson = useCallback(() => {
    setQuizWrongHint(null);
    setFlow((prev) => {
      if (prev.kind !== 'lesson') return prev;
      return { kind: 'quiz', courseId: prev.courseId, sectionIndex: prev.sectionIndex, questionIndex: 0 };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const answerQuiz = useCallback(
    (optionIndex: number) => {
      setFlow((prev) => {
        if (prev.kind !== 'quiz') return prev;
        const arr = getCourse(prev.courseId);
        const sec = arr[prev.sectionIndex];
        const q = sec.quiz[prev.questionIndex];
        if (optionIndex !== q.correctIndex) {
          queueMicrotask(() => setQuizWrongHint(q.wrongHint));
          return prev;
        }

        queueMicrotask(() => setQuizWrongHint(null));
        if (prev.questionIndex === 0) {
          return {
            kind: 'quiz',
            courseId: prev.courseId,
            sectionIndex: prev.sectionIndex,
            questionIndex: 1,
          };
        }

        const nextSection = prev.sectionIndex + 1;
        const total = arr.length;
        if (nextSection >= total) {
          return { kind: 'done', courseId: prev.courseId };
        }
        const freeN = getFreeCount(prev.courseId);
        if (nextSection >= freeN && !readHasFullAccess(prev.courseId)) {
          return { kind: 'paywall', courseId: prev.courseId };
        }
        return { kind: 'lesson', courseId: prev.courseId, sectionIndex: nextSection };
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const unlockAndContinue = useCallback(() => {
    setQuizWrongHint(null);
    setFlow((prev) => {
      if (prev.kind !== 'paywall') return prev;
      writeFullAccess(prev.courseId, true);
      return {
        kind: 'lesson',
        courseId: prev.courseId,
        sectionIndex: getFreeCount(prev.courseId),
      };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goSubscribe = useCallback(() => {
    navigate('/?panel=profile');
  }, [navigate]);

  if (flow.kind === 'paywall') {
    const cont =
      flow.courseId === 'astro'
        ? 'Продолжение: разделы «Мифы и заблуждения» — «Заключение» и оставшиеся тесты — в полной версии.'
        : flow.courseId === 'tarot'
          ? 'Продолжение: разделы «Мифы и страхи» — «Заключение» и оставшиеся тесты — в полной версии.'
          : 'Продолжение: разделы «Заблуждения и мифы» — «Заключение» и оставшиеся тесты — в полной версии.';
    return (
      <div className="product-page education-page">
        <section className="education-flow education-paywall">
          <button type="button" className="education-back-btn" onClick={backToList}>
            ← К программам
          </button>
          <h2 className="education-flow-title">Дальше — по подписке</h2>
          <p className="education-paywall-lead">
            Вы прошли бесплатную часть курса (около {progressPercent}% материала). Полный доступ к оставшимся
            разделам лекции и прогресс по тестам будут доступны после оформления подписки в продукте.
          </p>
          <div className="education-subscription-banner" role="status">
            <span className="education-subscription-banner-label">Подписка</span>
            <p>{cont}</p>
          </div>
          <div className="education-paywall-actions">
            <button type="button" className="education-primary-btn" onClick={goSubscribe}>
              Оформить подписку
            </button>
            <button type="button" className="education-secondary-btn" onClick={unlockAndContinue}>
              У меня уже есть доступ
            </button>
          </div>
          <p className="education-paywall-note">
            Для демонстрации интерфейса кнопка «У меня уже есть доступ» разблокирует материал локально на этом
            устройстве.
          </p>
        </section>
      </div>
    );
  }

  if (flow.kind === 'done') {
    const title =
      flow.courseId === 'astro' ? 'Астрология' : flow.courseId === 'tarot' ? 'Таро' : 'Луна и ритмы';
    return (
      <div className="product-page education-page">
        <section className="education-flow education-result">
          <button type="button" className="education-back-btn" onClick={backToList}>
            ← К программам
          </button>
          <h2 className="education-flow-title">Лекция пройдена</h2>
          <p className="education-result-score">Вы завершили курс «{title}» и все тесты по разделам.</p>
          <button type="button" className="education-primary-btn" onClick={backToList}>
            Назад к обучению
          </button>
        </section>
      </div>
    );
  }

  if (flow.kind === 'lesson' && section) {
    return (
      <div className="product-page education-page">
        <section className="education-flow education-lesson">
          <button type="button" className="education-back-btn" onClick={backToList}>
            ← К программам
          </button>
          <div className="education-progress" aria-hidden>
            <div className="education-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="education-progress-label">Прогресс: {progressPercent}%</p>
          <h2 className="education-flow-title">{section.title}</h2>
          <div className="education-lesson-body">
            {section.lessonParagraphs.map((p, i) => (
              <p key={i} className="education-lesson-p">
                {p}
              </p>
            ))}
          </div>
          <button type="button" className="education-primary-btn" onClick={goNextAfterLesson}>
            Перейти к вопросам по этому разделу
          </button>
        </section>
      </div>
    );
  }

  if (flow.kind === 'quiz' && section) {
    const q = section.quiz[flow.questionIndex];
    return (
      <div className="product-page education-page">
        <section className="education-flow education-quiz">
          <button
            type="button"
            className="education-back-btn"
            onClick={() => {
              setQuizWrongHint(null);
              setFlow({ kind: 'lesson', courseId: flow.courseId, sectionIndex: flow.sectionIndex });
            }}
          >
            ← К тексту раздела
          </button>
          <div className="education-progress" aria-hidden>
            <div className="education-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="education-progress-label">
            Раздел {flow.sectionIndex + 1} из {totalSections} · вопрос {flow.questionIndex + 1} из 2
          </p>
          <h2 className="education-flow-title">{section.title}</h2>
          {quizWrongHint ? (
            <div className="education-quiz-wrong" role="alert" aria-live="polite">
              <p className="education-quiz-wrong-title">Ответ неверный, попробуйте снова</p>
              <p className="education-quiz-wrong-hint">{quizWrongHint}</p>
            </div>
          ) : null}
          <fieldset className="education-quiz-fieldset">
            <legend className="education-quiz-question">{q.question}</legend>
            <div className="education-quiz-options">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className="education-quiz-option"
                  onClick={() => answerQuiz(i)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      </div>
    );
  }

  return (
    <div className="product-page education-page">
      <section className="product-hero product-hero--learn education-hero">
        <h1>Обучение</h1>
        <p>
          Интерактивные материалы по астрологии, Таро и лунным ритмам: лекции по разделам и проверочные вопросы после
          каждого блока.
        </p>
      </section>

      <section className="education-tracks" aria-label="Направления обучения">
        <div className="education-tracks-head">
          <h2 className="education-tracks-heading">Программы</h2>
          <p className="education-tracks-sub">Выберите направление — откроется первая лекция</p>
        </div>
        <ul className="education-track-list">
          {EDU_PROGRAMS.map((prog) => (
            <li key={prog.id}>
              <article
                className={`education-track-card education-track-card--interactive education-track-card--${prog.theme}`}
              >
                <button type="button" className="education-track-open" onClick={() => openCourse(prog.id)}>
                  <div className="education-track-layout">
                    <div className="education-track-icon" aria-hidden>
                      {prog.theme === 'tarot' ? <span className="education-track-tarot-card" /> : prog.icon}
                    </div>
                    <div className="education-track-main">
                      <div className="education-track-head">
                        <span className="education-track-badge">Лекция · тесты</span>
                        <span className="education-track-cta">Начать →</span>
                      </div>
                      <span className="education-track-title">{prog.title}</span>
                      <p className="education-track-desc">{prog.desc}</p>
                      <div className="education-track-foot" aria-hidden>
                        <span className="education-track-stat">Разделов: {prog.sections}</span>
                        <span className="education-track-stat education-track-stat--free">
                          Бесплатно: {prog.freeSections}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
