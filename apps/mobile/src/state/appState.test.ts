import { AppData, NutritionLog, ProgressEntry, UserProfile, WorkoutLog } from "../types";
import { mergeSnapshot, updateWorkoutInList } from "./appState";

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

function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    name: "Default",
    age: 28,
    heightCm: 176,
    currentWeightKg: 74,
    goal: "maintain",
    dailyCalorieTarget: 2400,
    proteinTargetGrams: 140,
    ...partial
  };
}

function makeWorkout(partial: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "wk-1",
    date: "2026-02-16",
    workoutType: "strength",
    durationMinutes: 45,
    exerciseEntries: [
      {
        id: "ex-1",
        name: "Barbell Bench Press",
        sets: 4,
        reps: 6,
        weightKg: 70
      }
    ],
    intensityRpe: 8,
    caloriesBurned: 320,
    templateName: "Push A",
    notes: "initial",
    createdAt: "2026-02-16T10:00:00.000Z",
    syncedAt: "2026-02-16T10:05:00.000Z",
    ...partial
  };
}

function makeNutrition(partial: Partial<NutritionLog> = {}): NutritionLog {
  return {
    date: "2026-02-16",
    calories: 2200,
    protein: 150,
    carbs: 230,
    fat: 70,
    waterLiters: 2.4,
    ...partial
  };
}

function makeProgress(partial: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    id: "prog-1",
    date: "2026-02-16",
    weightKg: 74,
    ...partial
  };
}

function makeLocalData(): AppData {
  return {
    auth: {
      userId: "user-1",
      email: "user@example.com",
      token: "token"
    },
    profile: makeProfile(),
    workouts: [makeWorkout()],
    nutritionByDate: {
      "2026-02-16": makeNutrition()
    },
    progressEntries: [makeProgress()],
    sync: {
      profilePending: false,
      nutritionPendingDates: [],
      progressPendingIds: [],
      deletedWorkoutIds: [],
      deletedNutritionDates: [],
      deletedProgressIds: [],
      lastSuccessfulSyncAt: null
    },
    settings: {
      dailyReminderEnabled: false,
      dailyReminderTime: "20:00",
      reminderNotificationId: null
    }
  };
}

runTest("mergeSnapshot uses remote profile when local profile is not pending", () => {
  const local = makeLocalData();
  const remote = {
    profile: makeProfile({
      name: "Remote Fresh Name"
    }),
    workouts: [],
    nutritionByDate: {},
    progressEntries: []
  };

  const merged = mergeSnapshot(local, remote);
  assertEqual(merged.profile?.name, "Remote Fresh Name", "profile.name");
});

runTest("mergeSnapshot keeps local profile when profile sync is pending", () => {
  const local = makeLocalData();
  local.sync.profilePending = true;
  local.profile = makeProfile({
    name: "Local Pending Name"
  });

  const remote = {
    profile: makeProfile({
      name: "Remote Older Name"
    }),
    workouts: [],
    nutritionByDate: {},
    progressEntries: []
  };

  const merged = mergeSnapshot(local, remote);
  assertEqual(merged.profile?.name, "Local Pending Name", "profile.name");
});

runTest("updateWorkoutInList updates workout fields and marks it unsynced", () => {
  const workouts = [makeWorkout()];

  const result = updateWorkoutInList(workouts, "wk-1", {
    workoutType: "cardio",
    durationMinutes: 30,
    exerciseEntries: [
      {
        id: "ex-2",
        name: "Bike Intervals",
        sets: 8,
        reps: 1
      }
    ],
    intensityRpe: 7.5,
    caloriesBurned: 420,
    templateName: "Conditioning",
    notes: undefined
  });

  assert(result.updatedWorkout !== null, "updated workout should exist");
  assertEqual(result.workouts.length, 1, "workout count");

  const updated = result.workouts[0];
  assertEqual(updated.id, "wk-1", "workout.id");
  assertEqual(updated.date, "2026-02-16", "workout.date");
  assertEqual(updated.createdAt, "2026-02-16T10:00:00.000Z", "workout.createdAt");
  assertEqual(updated.workoutType, "cardio", "workout.workoutType");
  assertEqual(updated.durationMinutes, 30, "workout.durationMinutes");
  assertEqual(updated.exerciseEntries.length, 1, "workout.exerciseEntries.length");
  assertEqual(updated.exerciseEntries[0].name, "Bike Intervals", "workout.exerciseEntries[0].name");
  assertEqual(updated.intensityRpe, 7.5, "workout.intensityRpe");
  assertEqual(updated.caloriesBurned, 420, "workout.caloriesBurned");
  assertEqual(updated.templateName, "Conditioning", "workout.templateName");
  assertEqual(updated.notes, undefined, "workout.notes");
  assertEqual(updated.syncedAt, null, "workout.syncedAt");
});

runTest("updateWorkoutInList is a no-op for unknown workout ids", () => {
  const workouts = [makeWorkout()];
  const result = updateWorkoutInList(workouts, "missing-id", {
    workoutType: "mobility",
    durationMinutes: 25,
    exerciseEntries: []
  });

  assertEqual(result.updatedWorkout, null, "updatedWorkout");
  assertEqual(result.workouts, workouts, "workout list reference");
});
