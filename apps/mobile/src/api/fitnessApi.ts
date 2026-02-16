import { Platform } from "react-native";

import { AppData, NutritionLog, ProgressEntry, SamplePlan, UserProfile, WorkoutLog } from "../types";

export type ServerSnapshot = Omit<AppData, "sync" | "settings">;

const apiBaseFromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL =
  apiBaseFromEnv && apiBaseFromEnv.trim().length > 0
    ? apiBaseFromEnv
    :
  Platform.OS === "android"
    ? "http://10.0.2.2:4000"
    : "http://localhost:4000";

async function fetchWithTimeout(path: string, init: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncWorkoutLog(log: WorkoutLog): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/workouts/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: log.id,
        date: log.date,
        workoutType: log.workoutType,
        durationMinutes: log.durationMinutes,
        notes: log.notes,
        createdAt: log.createdAt,
        syncedAt: log.syncedAt
      })
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function fetchSamplePlan(goal?: UserProfile["goal"]): Promise<SamplePlan | null> {
  try {
    const suffix = goal ? `?goal=${goal}` : "";
    const response = await fetchWithTimeout(`/api/v1/plans/sample${suffix}`, {
      method: "GET"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SamplePlan;
  } catch (_error) {
    return null;
  }
}

export async function fetchSnapshot(): Promise<ServerSnapshot | null> {
  try {
    const response = await fetchWithTimeout("/api/v1/sync/snapshot", {
      method: "GET"
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ServerSnapshot;
  } catch (_error) {
    return null;
  }
}

export async function syncProfile(profile: UserProfile): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function syncNutritionLog(log: NutritionLog): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`/api/v1/nutrition/logs/${log.date}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(log)
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function syncProgressEntry(entry: ProgressEntry): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/progress/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(entry)
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function clearRemoteData(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/sync/data", {
      method: "DELETE"
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}
