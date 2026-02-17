import { WorkoutDraft, WorkoutLog } from "../types";
import { getScienceBasedInsight, getWorkoutDraftGuidance } from "./scienceTraining";

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

function makeWorkout(partial: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "wk-1",
    date: "2026-02-17",
    workoutType: "strength",
    durationMinutes: 60,
    exerciseEntries: [
      { id: "ex-1", name: "Barbell Bench Press", sets: 4, reps: 8, weightKg: 70 },
      { id: "ex-2", name: "Chest Supported Row", sets: 4, reps: 10, weightKg: 50 },
      { id: "ex-3", name: "Back Squat", sets: 4, reps: 6, weightKg: 90 }
    ],
    intensityRpe: 8,
    caloriesBurned: 420,
    templateName: "Strength A",
    notes: "solid",
    createdAt: "2026-02-17T08:00:00.000Z",
    syncedAt: null,
    ...partial
  };
}

runTest("science insight reports weekly volume landmarks and progression", () => {
  const workouts: WorkoutLog[] = [
    makeWorkout(),
    makeWorkout({
      id: "wk-2",
      date: "2026-02-14",
      exerciseEntries: [
        { id: "ex-4", name: "Barbell Bench Press", sets: 4, reps: 7, weightKg: 67.5 },
        { id: "ex-5", name: "Lat Pulldown", sets: 3, reps: 10, weightKg: 55 }
      ],
      intensityRpe: 8.5,
      createdAt: "2026-02-14T08:00:00.000Z"
    })
  ];

  const insight = getScienceBasedInsight(
    "gain_muscle",
    workouts,
    new Date("2026-02-17T12:00:00.000Z")
  );

  const chest = insight.weeklyVolume.find((item) => item.group === "chest");
  assert(chest !== undefined, "chest summary should exist");
  assertEqual(chest?.status, "low", "chest.status");
  assert(insight.progressionTips.some((line) => line.includes("Barbell Bench Press")), "bench progression tip");
});

runTest("science insight flags high fatigue when frequency and effort spike", () => {
  const workouts: WorkoutLog[] = [
    makeWorkout({ id: "wk-a", date: "2026-02-17", intensityRpe: 9.1 }),
    makeWorkout({ id: "wk-b", date: "2026-02-16", intensityRpe: 9.2 }),
    makeWorkout({ id: "wk-c", date: "2026-02-15", intensityRpe: 9.0 }),
    makeWorkout({ id: "wk-d", date: "2026-02-14", intensityRpe: 9.3 }),
    makeWorkout({ id: "wk-e", date: "2026-02-13", intensityRpe: 9.1 })
  ];

  const insight = getScienceBasedInsight(
    "maintain",
    workouts,
    new Date("2026-02-17T12:00:00.000Z")
  );

  assert(insight.recoveryMessage.includes("Fatigue flag"), "fatigue warning should be present");
});

runTest("draft guidance enforces RPE and duration ranges with progression hint", () => {
  const workouts: WorkoutLog[] = [
    makeWorkout({
      id: "wk-prev",
      date: "2026-02-12",
      exerciseEntries: [{ id: "ex-prev", name: "Barbell Bench Press", sets: 4, reps: 6, weightKg: 80 }],
      createdAt: "2026-02-12T08:00:00.000Z"
    })
  ];

  const draft: WorkoutDraft = {
    workoutType: "strength",
    durationMinutes: 100,
    exerciseEntries: [{ id: "ex-now", name: "Barbell Bench Press", sets: 4, reps: 6, weightKg: 82.5 }],
    intensityRpe: 9.6,
    caloriesBurned: 500,
    notes: "hard day"
  };

  const guidance = getWorkoutDraftGuidance(
    "lose_weight",
    draft,
    workouts,
    new Date("2026-02-17T12:00:00.000Z")
  );

  assertEqual(guidance.targetRpe.min, 6.5, "targetRpe.min");
  assertEqual(guidance.targetRpe.max, 8.5, "targetRpe.max");
  assert(guidance.warnings.some((line) => line.includes("above the target range")), "high-rpe warning");
  assert(guidance.warnings.some((line) => line.includes("longer than")), "duration warning");
  assert(guidance.progressionHints.some((line) => line.includes("Barbell Bench Press")), "progression hint");
});
