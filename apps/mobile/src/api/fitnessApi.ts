import { Platform } from "react-native";

import { AppData, NutritionLog, ProgressEntry, SamplePlan, UserProfile, WorkoutLog } from "../types";

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export type ServerSnapshot = Omit<AppData, "auth" | "sync" | "settings">;

const apiBaseFromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL =
  apiBaseFromEnv && apiBaseFromEnv.trim().length > 0
    ? apiBaseFromEnv
    :
  Platform.OS === "android"
    ? "http://10.0.2.2:4000"
    : "http://localhost:4000";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function withAuthHeaders(headers: HeadersInit | undefined, includeJson: boolean): Headers {
  const next = new Headers(headers);
  if (includeJson && !next.has("Content-Type")) {
    next.set("Content-Type", "application/json");
  }
  if (authToken) {
    next.set("Authorization", `Bearer ${authToken}`);
  }
  return next;
}

async function fetchWithTimeout(path: string, init: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: withAuthHeaders(init.headers, false),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(path, init);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch (_error) {
    return null;
  }
}

export async function registerWithEmail(email: string, password: string): Promise<AuthResponse | null> {
  return fetchJson<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: withAuthHeaders(undefined, true),
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse | null> {
  return fetchJson<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: withAuthHeaders(undefined, true),
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function fetchMe(): Promise<AuthUser | null> {
  const response = await fetchJson<{ user: AuthUser }>("/api/v1/auth/me", {
    method: "GET"
  });
  return response?.user ?? null;
}

export async function logoutAuth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/auth/logout", {
      method: "POST"
    });
    return response.ok || response.status === 204;
  } catch (_error) {
    return false;
  }
}

export async function syncWorkoutLog(log: WorkoutLog): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/workouts/logs", {
      method: "POST",
      headers: withAuthHeaders(undefined, true),
      body: JSON.stringify({
        id: log.id,
        date: log.date,
        workoutType: log.workoutType,
        durationMinutes: log.durationMinutes,
        exerciseEntries: log.exerciseEntries,
        intensityRpe: log.intensityRpe,
        caloriesBurned: log.caloriesBurned,
        templateName: log.templateName,
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
  return fetchJson<ServerSnapshot>("/api/v1/sync/snapshot", {
    method: "GET"
  });
}

export async function syncProfile(profile: UserProfile): Promise<boolean> {
  try {
    const response = await fetchWithTimeout("/api/v1/profile", {
      method: "PUT",
      headers: withAuthHeaders(undefined, true),
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
      headers: withAuthHeaders(undefined, true),
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
      headers: withAuthHeaders(undefined, true),
      body: JSON.stringify(entry)
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function deleteWorkoutLog(id: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`/api/v1/workouts/logs/${id}`, {
      method: "DELETE"
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function deleteNutritionLog(date: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`/api/v1/nutrition/logs/${date}`, {
      method: "DELETE"
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function deleteProgressEntry(id: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`/api/v1/progress/entries/${id}`, {
      method: "DELETE"
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
