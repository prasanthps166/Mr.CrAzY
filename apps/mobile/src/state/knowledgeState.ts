export interface LessonProgressEntry {
  attempts: number;
  correct: number;
  lastAttemptAt: string;
  lastSelectedIndex: number;
}

export interface KnowledgeProgress {
  completedLessonIds: string[];
  lessonQuizProgress: Record<string, LessonProgressEntry>;
  learningActivityDates: string[];
}

export interface KnowledgeProgressStats {
  completedLessons: number;
  attempts: number;
  accuracyPct: number;
  activeDays: number;
}

export function createEmptyKnowledgeProgress(): KnowledgeProgress {
  return {
    completedLessonIds: [],
    lessonQuizProgress: {},
    learningActivityDates: []
  };
}

function withUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

export function markLessonCompleted(
  progress: KnowledgeProgress,
  lessonId: string,
  activityDate: string
): KnowledgeProgress {
  return {
    ...progress,
    completedLessonIds: withUnique(progress.completedLessonIds, lessonId),
    learningActivityDates: withUnique(progress.learningActivityDates, activityDate)
  };
}

export function recordQuizAttempt(
  progress: KnowledgeProgress,
  lessonId: string,
  selectedIndex: number,
  correct: boolean,
  attemptedAt: string,
  activityDate: string
): KnowledgeProgress {
  const existing = progress.lessonQuizProgress[lessonId];
  const nextEntry: LessonProgressEntry = {
    attempts: (existing?.attempts ?? 0) + 1,
    correct: (existing?.correct ?? 0) + (correct ? 1 : 0),
    lastAttemptAt: attemptedAt,
    lastSelectedIndex: selectedIndex
  };

  return {
    ...progress,
    completedLessonIds: withUnique(progress.completedLessonIds, lessonId),
    lessonQuizProgress: {
      ...progress.lessonQuizProgress,
      [lessonId]: nextEntry
    },
    learningActivityDates: withUnique(progress.learningActivityDates, activityDate)
  };
}

export function getKnowledgeStats(progress: KnowledgeProgress): KnowledgeProgressStats {
  const entries = Object.values(progress.lessonQuizProgress);
  const attempts = entries.reduce((sum, entry) => sum + entry.attempts, 0);
  const correct = entries.reduce((sum, entry) => sum + entry.correct, 0);
  const accuracyPct = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  return {
    completedLessons: progress.completedLessonIds.length,
    attempts,
    accuracyPct,
    activeDays: progress.learningActivityDates.length
  };
}

function toHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickDailyLessonId(
  dateKey: string,
  prioritizedLessonIds: string[]
): string | null {
  if (!prioritizedLessonIds.length) {
    return null;
  }

  const index = toHash(dateKey) % prioritizedLessonIds.length;
  return prioritizedLessonIds[index];
}
