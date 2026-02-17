import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppData, WorkoutExerciseEntry, WorkoutLog } from "../types";

const STORAGE_KEY = "@fittrack/app-data/v1";

export function createEmptyAppData(): AppData {
  return {
    auth: {
      userId: null,
      email: null,
      token: null
    },
    profile: null,
    workouts: [],
    nutritionByDate: {},
    progressEntries: [],
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

export const emptyAppData: AppData = createEmptyAppData();

function sanitizeExerciseEntries(input: unknown): WorkoutExerciseEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const row = item as Partial<WorkoutExerciseEntry>;
    if (typeof row.name !== "string" || !row.name.trim()) {
      return [];
    }

    const sets = Number(row.sets);
    const reps = Number(row.reps);
    if (!Number.isFinite(sets) || !Number.isFinite(reps) || sets < 1 || reps < 1) {
      return [];
    }

    const weight = Number(row.weightKg);

    return [
      {
        id: typeof row.id === "string" && row.id.trim() ? row.id : `ex_local_${index}`,
        name: row.name.trim(),
        sets: Math.round(sets),
        reps: Math.round(reps),
        weightKg: Number.isFinite(weight) && weight >= 0 ? weight : undefined
      }
    ];
  });
}

function sanitizeWorkoutLog(input: unknown, index: number): WorkoutLog | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Partial<WorkoutLog>;
  const duration = Number(row.durationMinutes);
  const intensity = Number(row.intensityRpe);
  const calories = Number(row.caloriesBurned);

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id : `wk_local_${index}`,
    date: typeof row.date === "string" ? row.date : new Date().toISOString().slice(0, 10),
    workoutType:
      row.workoutType === "strength" || row.workoutType === "cardio" || row.workoutType === "mobility"
        ? row.workoutType
        : "strength",
    durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 30,
    exerciseEntries: sanitizeExerciseEntries(row.exerciseEntries),
    intensityRpe: Number.isFinite(intensity) && intensity >= 1 && intensity <= 10
      ? Number(intensity.toFixed(1))
      : undefined,
    caloriesBurned: Number.isFinite(calories) && calories >= 0 ? Math.round(calories) : undefined,
    templateName: typeof row.templateName === "string" && row.templateName.trim()
      ? row.templateName.trim()
      : undefined,
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    syncedAt: typeof row.syncedAt === "string" ? row.syncedAt : null
  };
}

function sanitize(input: Partial<AppData>): AppData {
  const workouts = Array.isArray(input.workouts)
    ? input.workouts.flatMap((entry, index) => {
        const sanitized = sanitizeWorkoutLog(entry, index);
        return sanitized ? [sanitized] : [];
      })
    : [];

  return {
    auth: {
      userId: input.auth?.userId ?? null,
      email: input.auth?.email ?? null,
      token: input.auth?.token ?? null
    },
    profile: input.profile ?? null,
    workouts,
    nutritionByDate: input.nutritionByDate ?? {},
    progressEntries: Array.isArray(input.progressEntries) ? input.progressEntries : [],
    sync: {
      profilePending: input.sync?.profilePending ?? false,
      nutritionPendingDates: Array.isArray(input.sync?.nutritionPendingDates)
        ? input.sync.nutritionPendingDates
        : [],
      progressPendingIds: Array.isArray(input.sync?.progressPendingIds)
        ? input.sync.progressPendingIds
        : [],
      deletedWorkoutIds: Array.isArray(input.sync?.deletedWorkoutIds)
        ? input.sync.deletedWorkoutIds
        : [],
      deletedNutritionDates: Array.isArray(input.sync?.deletedNutritionDates)
        ? input.sync.deletedNutritionDates
        : [],
      deletedProgressIds: Array.isArray(input.sync?.deletedProgressIds)
        ? input.sync.deletedProgressIds
        : [],
      lastSuccessfulSyncAt: input.sync?.lastSuccessfulSyncAt ?? null
    },
    settings: {
      dailyReminderEnabled: input.settings?.dailyReminderEnabled ?? false,
      dailyReminderTime: input.settings?.dailyReminderTime ?? "20:00",
      reminderNotificationId: input.settings?.reminderNotificationId ?? null
    }
  };
}

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyAppData();
    }
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return sanitize(parsed);
  } catch (_error) {
    return createEmptyAppData();
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
