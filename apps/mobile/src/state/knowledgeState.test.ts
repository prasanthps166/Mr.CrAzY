import {
  createEmptyKnowledgeProgress,
  getKnowledgeStats,
  markLessonCompleted,
  pickDailyLessonId,
  recordQuizAttempt
} from "./knowledgeState";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)} but got ${String(actual)}`);
  }
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest("markLessonCompleted keeps unique lesson ids and activity dates", () => {
  const empty = createEmptyKnowledgeProgress();
  const once = markLessonCompleted(empty, "lesson-1", "2026-02-17");
  const twice = markLessonCompleted(once, "lesson-1", "2026-02-17");

  assertEqual(twice.completedLessonIds.length, 1, "completedLessonIds.length");
  assertEqual(twice.learningActivityDates.length, 1, "learningActivityDates.length");
});

runTest("recordQuizAttempt tracks attempts and correct counts", () => {
  const empty = createEmptyKnowledgeProgress();
  const afterWrong = recordQuizAttempt(
    empty,
    "lesson-2",
    0,
    false,
    "2026-02-17T10:00:00.000Z",
    "2026-02-17"
  );
  const afterRight = recordQuizAttempt(
    afterWrong,
    "lesson-2",
    1,
    true,
    "2026-02-17T11:00:00.000Z",
    "2026-02-17"
  );

  const entry = afterRight.lessonQuizProgress["lesson-2"];
  assert(entry !== undefined, "lesson quiz entry should exist");
  assertEqual(entry?.attempts, 2, "entry.attempts");
  assertEqual(entry?.correct, 1, "entry.correct");
  assertEqual(afterRight.completedLessonIds.includes("lesson-2"), true, "lesson completed");
});

runTest("getKnowledgeStats calculates accuracy and activity totals", () => {
  const empty = createEmptyKnowledgeProgress();
  const withAttempts = recordQuizAttempt(
    recordQuizAttempt(
      empty,
      "lesson-1",
      0,
      true,
      "2026-02-17T10:00:00.000Z",
      "2026-02-17"
    ),
    "lesson-1",
    1,
    false,
    "2026-02-18T10:00:00.000Z",
    "2026-02-18"
  );

  const stats = getKnowledgeStats(withAttempts);
  assertEqual(stats.attempts, 2, "stats.attempts");
  assertEqual(stats.accuracyPct, 50, "stats.accuracyPct");
  assertEqual(stats.activeDays, 2, "stats.activeDays");
});

runTest("pickDailyLessonId is deterministic for the same date and list", () => {
  const ids = ["a", "b", "c", "d"];
  const first = pickDailyLessonId("2026-02-17", ids);
  const second = pickDailyLessonId("2026-02-17", ids);
  const third = pickDailyLessonId("2026-02-18", ids);

  assertEqual(first, second, "same date should match");
  assert(first !== null, "daily lesson should exist");
  assert(third !== null, "daily lesson should exist on next day");
});
