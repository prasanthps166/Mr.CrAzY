import { Platform } from "react-native";

import { SamplePlan, WorkoutLog } from "../types";

const API_BASE_URL =
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
        date: log.date,
        workoutType: log.workoutType,
        durationMinutes: log.durationMinutes,
        notes: log.notes
      })
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

export async function fetchSamplePlan(): Promise<SamplePlan | null> {
  try {
    const response = await fetchWithTimeout("/api/v1/plans/sample", {
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

