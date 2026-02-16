import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppData } from "../types";

const STORAGE_KEY = "@fittrack/app-data/v1";

export const emptyAppData: AppData = {
  profile: null,
  workouts: [],
  nutritionByDate: {},
  progressEntries: []
};

function sanitize(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? null,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    nutritionByDate: input.nutritionByDate ?? {},
    progressEntries: Array.isArray(input.progressEntries) ? input.progressEntries : []
  };
}

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyAppData;
    }
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return sanitize(parsed);
  } catch (_error) {
    return emptyAppData;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

