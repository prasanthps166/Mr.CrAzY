import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import { config } from "./config.js";

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

type StorageBackend = "file" | "postgres";

const dataFilePath = fileURLToPath(new URL("../data/app-data.json", import.meta.url));

let activeBackend: StorageBackend = config.STORAGE_BACKEND;
let fallbackReason: string | null = null;

let fileCache: AppData | null = null;
let fileWriteQueue: Promise<void> = Promise.resolve();

let pool: Pool | null = null;
let postgresSchemaReady = false;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function activateFileFallback(error: unknown) {
  if (activeBackend !== "file") {
    fallbackReason = `Postgres unavailable: ${toErrorMessage(error)}`;
    console.warn(`[store] ${fallbackReason}. Falling back to file storage.`);
  }
  activeBackend = "file";
}

function sanitize(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? null,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    nutritionByDate: input.nutritionByDate ?? {},
    progressEntries: Array.isArray(input.progressEntries) ? input.progressEntries : []
  };
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  return Number(value ?? 0);
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function getPool(): Pool {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL
    });
  }

  return pool;
}

async function ensurePostgresSchema() {
  if (postgresSchemaReady) {
    return;
  }

  const pg = getPool();
  await pg.query(`
    create table if not exists app_profiles (
      id text primary key,
      name text not null,
      age int not null,
      height_cm int not null,
      current_weight_kg numeric(6,2) not null,
      goal text not null check (goal in ('lose_weight', 'gain_muscle', 'maintain')),
      daily_calorie_target int not null,
      protein_target_grams int not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists app_workout_logs (
      id text primary key,
      workout_date date not null,
      workout_type text not null check (workout_type in ('strength', 'cardio', 'mobility')),
      duration_minutes int not null,
      notes text,
      created_at timestamptz not null,
      synced_at timestamptz
    );

    create table if not exists app_nutrition_logs (
      nutrition_date date primary key,
      calories numeric(8,2) not null,
      protein numeric(8,2) not null,
      carbs numeric(8,2) not null,
      fat numeric(8,2) not null,
      water_liters numeric(5,2) not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists app_progress_entries (
      id text primary key,
      progress_date date not null,
      weight_kg numeric(6,2) not null,
      body_fat_pct numeric(5,2),
      waist_cm numeric(6,2),
      updated_at timestamptz not null default now()
    );
  `);

  postgresSchemaReady = true;
}

async function readAppDataFromPostgres(): Promise<AppData> {
  await ensurePostgresSchema();
  const pg = getPool();

  const [profileRes, workoutsRes, nutritionRes, progressRes] = await Promise.all([
    pg.query<{
      id: string;
      name: string;
      age: number;
      height_cm: number;
      current_weight_kg: string | number;
      goal: FitnessGoal;
      daily_calorie_target: number;
      protein_target_grams: number;
    }>("select id, name, age, height_cm, current_weight_kg, goal, daily_calorie_target, protein_target_grams from app_profiles limit 1"),
    pg.query<{
      id: string;
      workout_date: string;
      workout_type: WorkoutType;
      duration_minutes: number;
      notes: string | null;
      created_at: Date | string;
      synced_at: Date | string | null;
    }>("select id, workout_date::text, workout_type, duration_minutes, notes, created_at, synced_at from app_workout_logs order by workout_date desc, created_at desc"),
    pg.query<{
      nutrition_date: string;
      calories: string | number;
      protein: string | number;
      carbs: string | number;
      fat: string | number;
      water_liters: string | number;
    }>("select nutrition_date::text, calories, protein, carbs, fat, water_liters from app_nutrition_logs order by nutrition_date desc"),
    pg.query<{
      id: string;
      progress_date: string;
      weight_kg: string | number;
      body_fat_pct: string | number | null;
      waist_cm: string | number | null;
    }>("select id, progress_date::text, weight_kg, body_fat_pct, waist_cm from app_progress_entries order by progress_date desc")
  ]);

  const profileRow = profileRes.rows[0];
  const profile = profileRow
    ? {
        id: profileRow.id,
        name: profileRow.name,
        age: profileRow.age,
        heightCm: profileRow.height_cm,
        currentWeightKg: toNumber(profileRow.current_weight_kg),
        goal: profileRow.goal,
        dailyCalorieTarget: profileRow.daily_calorie_target,
        proteinTargetGrams: profileRow.protein_target_grams
      }
    : null;

  const workouts: WorkoutLog[] = workoutsRes.rows.map((row) => ({
    id: row.id,
    date: row.workout_date,
    workoutType: row.workout_type,
    durationMinutes: row.duration_minutes,
    notes: row.notes ?? undefined,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    syncedAt: toIso(row.synced_at)
  }));

  const nutritionByDate: Record<string, NutritionLog> = {};
  for (const row of nutritionRes.rows) {
    nutritionByDate[row.nutrition_date] = {
      date: row.nutrition_date,
      calories: toNumber(row.calories),
      protein: toNumber(row.protein),
      carbs: toNumber(row.carbs),
      fat: toNumber(row.fat),
      waterLiters: toNumber(row.water_liters)
    };
  }

  const progressEntries: ProgressEntry[] = progressRes.rows.map((row) => ({
    id: row.id,
    date: row.progress_date,
    weightKg: toNumber(row.weight_kg),
    bodyFatPct: row.body_fat_pct == null ? undefined : toNumber(row.body_fat_pct),
    waistCm: row.waist_cm == null ? undefined : toNumber(row.waist_cm)
  }));

  return {
    profile,
    workouts,
    nutritionByDate,
    progressEntries
  };
}

async function writeAppDataToPostgres(data: AppData): Promise<void> {
  await ensurePostgresSchema();
  const client = await getPool().connect();

  try {
    await client.query("begin");

    await client.query("delete from app_profiles");
    if (data.profile) {
      await client.query(
        `insert into app_profiles (id, name, age, height_cm, current_weight_kg, goal, daily_calorie_target, protein_target_grams, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
        [
          data.profile.id,
          data.profile.name,
          data.profile.age,
          data.profile.heightCm,
          data.profile.currentWeightKg,
          data.profile.goal,
          data.profile.dailyCalorieTarget,
          data.profile.proteinTargetGrams
        ]
      );
    }

    await client.query("delete from app_workout_logs");
    for (const workout of data.workouts) {
      await client.query(
        `insert into app_workout_logs (id, workout_date, workout_type, duration_minutes, notes, created_at, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          workout.id,
          workout.date,
          workout.workoutType,
          workout.durationMinutes,
          workout.notes ?? null,
          workout.createdAt,
          workout.syncedAt
        ]
      );
    }

    await client.query("delete from app_nutrition_logs");
    for (const entry of Object.values(data.nutritionByDate)) {
      await client.query(
        `insert into app_nutrition_logs (nutrition_date, calories, protein, carbs, fat, water_liters, updated_at)
         values ($1,$2,$3,$4,$5,$6, now())`,
        [entry.date, entry.calories, entry.protein, entry.carbs, entry.fat, entry.waterLiters]
      );
    }

    await client.query("delete from app_progress_entries");
    for (const entry of data.progressEntries) {
      await client.query(
        `insert into app_progress_entries (id, progress_date, weight_kg, body_fat_pct, waist_cm, updated_at)
         values ($1,$2,$3,$4,$5, now())`,
        [entry.id, entry.date, entry.weightKg, entry.bodyFatPct ?? null, entry.waistCm ?? null]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function resetPostgresData(): Promise<AppData> {
  await ensurePostgresSchema();
  await getPool().query(`
    truncate table app_profiles;
    truncate table app_workout_logs;
    truncate table app_nutrition_logs;
    truncate table app_progress_entries;
  `);
  return createDefaultAppData();
}

async function ensureDataDir() {
  await mkdir(dirname(dataFilePath), { recursive: true });
}

async function readAppDataFromFile(): Promise<AppData> {
  if (fileCache) {
    return fileCache;
  }

  await ensureDataDir();

  try {
    const raw = await readFile(dataFilePath, "utf-8");
    fileCache = sanitize(JSON.parse(raw) as Partial<AppData>);
  } catch (_error) {
    fileCache = createDefaultAppData();
    await writeAppDataToFile(fileCache);
  }

  return fileCache;
}

async function writeAppDataToFile(data: AppData): Promise<void> {
  fileCache = data;
  await ensureDataDir();
  fileWriteQueue = fileWriteQueue.then(() =>
    writeFile(dataFilePath, JSON.stringify(data, null, 2), "utf-8")
  );
  await fileWriteQueue;
}

async function resetFileData(): Promise<AppData> {
  const empty = createDefaultAppData();
  await writeAppDataToFile(empty);
  return empty;
}

export function getStorageInfo() {
  return {
    backend: activeBackend,
    fallbackReason
  };
}

export async function readAppData(): Promise<AppData> {
  if (activeBackend === "postgres") {
    try {
      return await readAppDataFromPostgres();
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return readAppDataFromFile();
}

export async function writeAppData(data: AppData): Promise<void> {
  if (activeBackend === "postgres") {
    try {
      await writeAppDataToPostgres(data);
      return;
    } catch (error) {
      activateFileFallback(error);
    }
  }

  await writeAppDataToFile(data);
}

export async function resetAppData(): Promise<AppData> {
  if (activeBackend === "postgres") {
    try {
      return await resetPostgresData();
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return resetFileData();
}

