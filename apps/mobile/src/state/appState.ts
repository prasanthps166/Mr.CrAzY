import { AppData, WorkoutDraft, WorkoutLog } from "../types";

export type SnapshotData = Omit<AppData, "auth" | "sync" | "settings">;

function mergeById<T extends { id: string }>(remoteItems: T[], localItems: T[]): T[] {
  const map = new Map<string, T>();
  for (const remoteItem of remoteItems) {
    map.set(remoteItem.id, remoteItem);
  }
  for (const localItem of localItems) {
    map.set(localItem.id, localItem);
  }
  return Array.from(map.values());
}

export function mergeSnapshot(local: AppData, remote: SnapshotData): AppData {
  const deletedWorkoutIds = new Set(local.sync.deletedWorkoutIds);
  const deletedNutritionDates = new Set(local.sync.deletedNutritionDates);
  const deletedProgressIds = new Set(local.sync.deletedProgressIds);

  const normalizedRemoteWorkouts = (remote.workouts ?? [])
    .map((entry) => ({
      ...entry,
      exerciseEntries: Array.isArray(entry.exerciseEntries) ? entry.exerciseEntries : [],
      intensityRpe: entry.intensityRpe,
      caloriesBurned: entry.caloriesBurned,
      templateName: entry.templateName,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      syncedAt: entry.syncedAt ?? new Date().toISOString()
    }))
    .filter((entry) => !deletedWorkoutIds.has(entry.id));

  const localWorkouts = local.workouts.filter((entry) => !deletedWorkoutIds.has(entry.id));

  const filteredRemoteNutrition = Object.fromEntries(
    Object.entries(remote.nutritionByDate ?? {}).filter(([date]) => !deletedNutritionDates.has(date))
  );
  const localNutrition = Object.fromEntries(
    Object.entries(local.nutritionByDate).filter(([date]) => !deletedNutritionDates.has(date))
  );

  const filteredRemoteProgress = (remote.progressEntries ?? []).filter(
    (entry) => !deletedProgressIds.has(entry.id)
  );
  const localProgress = local.progressEntries.filter((entry) => !deletedProgressIds.has(entry.id));
  const mergedProfile = local.sync.profilePending
    ? (local.profile ?? remote.profile ?? null)
    : (remote.profile ?? local.profile ?? null);

  return {
    auth: local.auth,
    profile: mergedProfile,
    workouts: mergeById(normalizedRemoteWorkouts, localWorkouts).sort((a, b) => {
      if (a.date === b.date) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.date.localeCompare(a.date);
    }),
    nutritionByDate: {
      ...filteredRemoteNutrition,
      ...localNutrition
    },
    progressEntries: mergeById(filteredRemoteProgress, localProgress).sort((a, b) =>
      b.date.localeCompare(a.date)
    ),
    sync: local.sync,
    settings: local.settings
  };
}

function buildUpdatedWorkout(existing: WorkoutLog, draft: WorkoutDraft): WorkoutLog {
  return {
    ...existing,
    workoutType: draft.workoutType,
    durationMinutes: draft.durationMinutes,
    exerciseEntries: draft.exerciseEntries,
    intensityRpe: draft.intensityRpe,
    caloriesBurned: draft.caloriesBurned,
    templateName: draft.templateName,
    notes: draft.notes,
    syncedAt: null
  };
}

export function updateWorkoutInList(
  workouts: WorkoutLog[],
  workoutId: string,
  draft: WorkoutDraft
): { workouts: WorkoutLog[]; updatedWorkout: WorkoutLog | null } {
  const existing = workouts.find((entry) => entry.id === workoutId);
  if (!existing) {
    return {
      workouts,
      updatedWorkout: null
    };
  }

  const updatedWorkout = buildUpdatedWorkout(existing, draft);

  return {
    workouts: workouts.map((entry) => (entry.id === workoutId ? updatedWorkout : entry)),
    updatedWorkout
  };
}
