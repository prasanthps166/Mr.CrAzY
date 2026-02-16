import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type FitnessGoal = "lose_weight" | "gain_muscle" | "maintain";
export type WorkoutType = "strength" | "cardio" | "mobility";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  goal: FitnessGoal;
  dailyCalorieTarget: number;
  proteinTargetGrams: number;
}

export interface WorkoutLog {
  id: string;
  date: string;
  workoutType: WorkoutType;
  durationMinutes: number;
  notes?: string;
  createdAt: string;
  syncedAt: string | null;
}

export interface NutritionLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterLiters: number;
}

export interface ProgressEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
}

export interface AppData {
  profile: UserProfile | null;
  workouts: WorkoutLog[];
  nutritionByDate: Record<string, NutritionLog>;
  progressEntries: ProgressEntry[];
}

export function createDefaultAppData(): AppData {
  return {
    profile: null,
    workouts: [],
    nutritionByDate: {},
    progressEntries: []
  };
}

const dataFilePath = fileURLToPath(new URL("../data/app-data.json", import.meta.url));

let cache: AppData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function sanitize(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? null,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    nutritionByDate: input.nutritionByDate ?? {},
    progressEntries: Array.isArray(input.progressEntries) ? input.progressEntries : []
  };
}

async function ensureDataDir() {
  await mkdir(dirname(dataFilePath), { recursive: true });
}

export async function readAppData(): Promise<AppData> {
  if (cache) {
    return cache;
  }

  await ensureDataDir();

  try {
    const raw = await readFile(dataFilePath, "utf-8");
    cache = sanitize(JSON.parse(raw) as Partial<AppData>);
  } catch (_error) {
    cache = createDefaultAppData();
    await writeAppData(cache);
  }

  return cache;
}

export async function writeAppData(data: AppData): Promise<void> {
  cache = data;
  await ensureDataDir();
  writeQueue = writeQueue.then(() =>
    writeFile(dataFilePath, JSON.stringify(data, null, 2), "utf-8")
  );
  await writeQueue;
}

export async function resetAppData(): Promise<AppData> {
  const empty = createDefaultAppData();
  await writeAppData(empty);
  return empty;
}
