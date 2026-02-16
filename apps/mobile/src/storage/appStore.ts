import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppData } from "../types";

const STORAGE_KEY = "@fittrack/app-data/v1";

export function createEmptyAppData(): AppData {
  return {
    profile: null,
    workouts: [],
    nutritionByDate: {},
    progressEntries: [],
    sync: {
      profilePending: false,
      nutritionPendingDates: [],
      progressPendingIds: [],
      lastSuccessfulSyncAt: null
    }
  };
}

export const emptyAppData: AppData = createEmptyAppData();

function sanitize(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? null,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
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
      lastSuccessfulSyncAt: input.sync?.lastSuccessfulSyncAt ?? null
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
