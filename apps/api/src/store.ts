import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
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

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthPublicUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
}

interface FileStoreData {
  users: AuthUser[];
  sessions: AuthSession[];
  userData: Record<string, AppData>;
}

export function createDefaultAppData(): AppData {
  return {
    profile: null,
    workouts: [],
    nutritionByDate: {},
    progressEntries: []
  };
}

const DEFAULT_USER_ID = "local-user";
type StorageBackend = "file" | "postgres";

const defaultDataFilePath = fileURLToPath(new URL("../data/app-data.json", import.meta.url));
const dataFilePath = config.FILE_STORAGE_PATH
  ? (isAbsolute(config.FILE_STORAGE_PATH) ? config.FILE_STORAGE_PATH : resolve(process.cwd(), config.FILE_STORAGE_PATH))
  : defaultDataFilePath;

let activeBackend: StorageBackend = config.STORAGE_BACKEND;
let fallbackReason: string | null = null;

let fileCache: FileStoreData | null = null;
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

function toPublicUser(user: AuthUser): AuthPublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt
  };
}

function sanitizeAppData(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? null,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    nutritionByDate: input.nutritionByDate ?? {},
    progressEntries: Array.isArray(input.progressEntries) ? input.progressEntries : []
  };
}

function createDefaultFileStoreData(): FileStoreData {
  return {
    users: [],
    sessions: [],
    userData: {
      [DEFAULT_USER_ID]: createDefaultAppData()
    }
  };
}

function sanitizeFileStoreData(input: unknown): FileStoreData {
  if (!input || typeof input !== "object") {
    return createDefaultFileStoreData();
  }

  const record = input as Record<string, unknown>;

  // Backward compatibility with old single AppData file format.
  if (
    "profile" in record ||
    "workouts" in record ||
    "nutritionByDate" in record ||
    "progressEntries" in record
  ) {
    return {
      users: [],
      sessions: [],
      userData: {
        [DEFAULT_USER_ID]: sanitizeAppData(record as Partial<AppData>)
      }
    };
  }

  const users = Array.isArray(record.users)
    ? record.users.filter((item): item is AuthUser => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const row = item as Partial<AuthUser>;
        return typeof row.id === "string"
          && typeof row.email === "string"
          && typeof row.passwordHash === "string"
          && typeof row.createdAt === "string";
      })
    : [];

  const sessions = Array.isArray(record.sessions)
    ? record.sessions.filter((item): item is AuthSession => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const row = item as Partial<AuthSession>;
        return typeof row.token === "string"
          && typeof row.userId === "string"
          && typeof row.createdAt === "string";
      })
    : [];

  const userDataRaw = record.userData;
  const userData: Record<string, AppData> = {};
  if (userDataRaw && typeof userDataRaw === "object") {
    for (const [userId, value] of Object.entries(userDataRaw as Record<string, unknown>)) {
      userData[userId] = sanitizeAppData(value as Partial<AppData>);
    }
  }

  if (!userData[DEFAULT_USER_ID]) {
    userData[DEFAULT_USER_ID] = createDefaultAppData();
  }

  return {
    users,
    sessions,
    userData
  };
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
    create table if not exists auth_users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists auth_sessions (
      token text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      created_at timestamptz not null default now()
    );

    create table if not exists app_profiles_v2 (
      user_id text primary key,
      profile_id text not null,
      name text not null,
      age int not null,
      height_cm int not null,
      current_weight_kg numeric(6,2) not null,
      goal text not null check (goal in ('lose_weight', 'gain_muscle', 'maintain')),
      daily_calorie_target int not null,
      protein_target_grams int not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists app_workout_logs_v2 (
      user_id text not null,
      id text not null,
      workout_date date not null,
      workout_type text not null check (workout_type in ('strength', 'cardio', 'mobility')),
      duration_minutes int not null,
      notes text,
      created_at timestamptz not null,
      synced_at timestamptz,
      primary key (user_id, id)
    );

    create table if not exists app_nutrition_logs_v2 (
      user_id text not null,
      nutrition_date date not null,
      calories numeric(8,2) not null,
      protein numeric(8,2) not null,
      carbs numeric(8,2) not null,
      fat numeric(8,2) not null,
      water_liters numeric(5,2) not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, nutrition_date)
    );

    create table if not exists app_progress_entries_v2 (
      user_id text not null,
      id text not null,
      progress_date date not null,
      weight_kg numeric(6,2) not null,
      body_fat_pct numeric(5,2),
      waist_cm numeric(6,2),
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    );
  `);

  postgresSchemaReady = true;
}

async function ensureDataDir() {
  await mkdir(dirname(dataFilePath), { recursive: true });
}

async function readFileStoreData(): Promise<FileStoreData> {
  if (fileCache) {
    return fileCache;
  }

  await ensureDataDir();

  try {
    const raw = await readFile(dataFilePath, "utf-8");
    fileCache = sanitizeFileStoreData(JSON.parse(raw));
  } catch (_error) {
    fileCache = createDefaultFileStoreData();
    await writeFileStoreData(fileCache);
  }

  return fileCache;
}

async function writeFileStoreData(data: FileStoreData): Promise<void> {
  fileCache = data;
  await ensureDataDir();
  fileWriteQueue = fileWriteQueue.then(() =>
    writeFile(dataFilePath, JSON.stringify(data, null, 2), "utf-8")
  );
  await fileWriteQueue;
}

async function readAppDataFromFile(userId: string): Promise<AppData> {
  const data = await readFileStoreData();
  if (!data.userData[userId]) {
    data.userData[userId] = createDefaultAppData();
    await writeFileStoreData(data);
  }
  return sanitizeAppData(data.userData[userId]);
}

async function writeAppDataToFile(userId: string, appData: AppData): Promise<void> {
  const data = await readFileStoreData();
  data.userData[userId] = sanitizeAppData(appData);
  await writeFileStoreData(data);
}

async function resetAppDataInFile(userId: string): Promise<AppData> {
  const data = await readFileStoreData();
  data.userData[userId] = createDefaultAppData();
  await writeFileStoreData(data);
  return data.userData[userId];
}

async function getAuthUserByEmailFromFile(email: string): Promise<AuthUser | null> {
  const data = await readFileStoreData();
  return data.users.find((item) => item.email === email) ?? null;
}

async function getAuthUserByIdFromFile(userId: string): Promise<AuthPublicUser | null> {
  const data = await readFileStoreData();
  const row = data.users.find((item) => item.id === userId);
  return row ? toPublicUser(row) : null;
}

async function createAuthUserInFile(user: AuthUser): Promise<{ ok: boolean; reason?: string }> {
  const data = await readFileStoreData();
  if (data.users.some((item) => item.email === user.email)) {
    return {
      ok: false,
      reason: "Email is already registered"
    };
  }

  data.users.push(user);
  if (!data.userData[user.id]) {
    data.userData[user.id] = createDefaultAppData();
  }

  await writeFileStoreData(data);
  return { ok: true };
}

async function createAuthSessionInFile(token: string, userId: string): Promise<void> {
  const data = await readFileStoreData();
  data.sessions.push({
    token,
    userId,
    createdAt: new Date().toISOString()
  });
  await writeFileStoreData(data);
}

async function getAuthSessionUserIdFromFile(token: string): Promise<string | null> {
  const data = await readFileStoreData();
  const row = data.sessions.find((item) => item.token === token);
  return row?.userId ?? null;
}

async function deleteAuthSessionInFile(token: string): Promise<void> {
  const data = await readFileStoreData();
  data.sessions = data.sessions.filter((item) => item.token !== token);
  await writeFileStoreData(data);
}

async function readAppDataFromPostgres(userId: string): Promise<AppData> {
  await ensurePostgresSchema();
  const pg = getPool();

  const [profileRes, workoutsRes, nutritionRes, progressRes] = await Promise.all([
    pg.query<{
      profile_id: string;
      name: string;
      age: number;
      height_cm: number;
      current_weight_kg: string | number;
      goal: FitnessGoal;
      daily_calorie_target: number;
      protein_target_grams: number;
    }>(
      "select profile_id, name, age, height_cm, current_weight_kg, goal, daily_calorie_target, protein_target_grams from app_profiles_v2 where user_id = $1 limit 1",
      [userId]
    ),
    pg.query<{
      id: string;
      workout_date: string;
      workout_type: WorkoutType;
      duration_minutes: number;
      notes: string | null;
      created_at: Date | string;
      synced_at: Date | string | null;
    }>(
      "select id, workout_date::text, workout_type, duration_minutes, notes, created_at, synced_at from app_workout_logs_v2 where user_id = $1 order by workout_date desc, created_at desc",
      [userId]
    ),
    pg.query<{
      nutrition_date: string;
      calories: string | number;
      protein: string | number;
      carbs: string | number;
      fat: string | number;
      water_liters: string | number;
    }>(
      "select nutrition_date::text, calories, protein, carbs, fat, water_liters from app_nutrition_logs_v2 where user_id = $1 order by nutrition_date desc",
      [userId]
    ),
    pg.query<{
      id: string;
      progress_date: string;
      weight_kg: string | number;
      body_fat_pct: string | number | null;
      waist_cm: string | number | null;
    }>(
      "select id, progress_date::text, weight_kg, body_fat_pct, waist_cm from app_progress_entries_v2 where user_id = $1 order by progress_date desc",
      [userId]
    )
  ]);

  const profileRow = profileRes.rows[0];
  const profile = profileRow
    ? {
        id: profileRow.profile_id,
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

async function writeAppDataToPostgres(userId: string, data: AppData): Promise<void> {
  await ensurePostgresSchema();
  const client = await getPool().connect();

  try {
    await client.query("begin");

    await client.query("delete from app_profiles_v2 where user_id = $1", [userId]);
    if (data.profile) {
      await client.query(
        `insert into app_profiles_v2 (user_id, profile_id, name, age, height_cm, current_weight_kg, goal, daily_calorie_target, protein_target_grams, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())`,
        [
          userId,
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

    await client.query("delete from app_workout_logs_v2 where user_id = $1", [userId]);
    for (const workout of data.workouts) {
      await client.query(
        `insert into app_workout_logs_v2 (user_id, id, workout_date, workout_type, duration_minutes, notes, created_at, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          userId,
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

    await client.query("delete from app_nutrition_logs_v2 where user_id = $1", [userId]);
    for (const entry of Object.values(data.nutritionByDate)) {
      await client.query(
        `insert into app_nutrition_logs_v2 (user_id, nutrition_date, calories, protein, carbs, fat, water_liters, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7, now())`,
        [userId, entry.date, entry.calories, entry.protein, entry.carbs, entry.fat, entry.waterLiters]
      );
    }

    await client.query("delete from app_progress_entries_v2 where user_id = $1", [userId]);
    for (const entry of data.progressEntries) {
      await client.query(
        `insert into app_progress_entries_v2 (user_id, id, progress_date, weight_kg, body_fat_pct, waist_cm, updated_at)
         values ($1,$2,$3,$4,$5,$6, now())`,
        [userId, entry.id, entry.date, entry.weightKg, entry.bodyFatPct ?? null, entry.waistCm ?? null]
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

async function resetAppDataInPostgres(userId: string): Promise<AppData> {
  await ensurePostgresSchema();
  const pg = getPool();
  await pg.query("delete from app_profiles_v2 where user_id = $1", [userId]);
  await pg.query("delete from app_workout_logs_v2 where user_id = $1", [userId]);
  await pg.query("delete from app_nutrition_logs_v2 where user_id = $1", [userId]);
  await pg.query("delete from app_progress_entries_v2 where user_id = $1", [userId]);
  return createDefaultAppData();
}

async function getAuthUserByEmailFromPostgres(email: string): Promise<AuthUser | null> {
  await ensurePostgresSchema();
  const result = await getPool().query<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date | string;
  }>(
    "select id, email, password_hash, created_at from auth_users where email = $1 limit 1",
    [email]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: toIso(row.created_at) ?? new Date().toISOString()
  };
}

async function getAuthUserByIdFromPostgres(userId: string): Promise<AuthPublicUser | null> {
  await ensurePostgresSchema();
  const result = await getPool().query<{
    id: string;
    email: string;
    created_at: Date | string;
  }>(
    "select id, email, created_at from auth_users where id = $1 limit 1",
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    createdAt: toIso(row.created_at) ?? new Date().toISOString()
  };
}

async function createAuthUserInPostgres(user: AuthUser): Promise<{ ok: boolean; reason?: string }> {
  await ensurePostgresSchema();
  try {
    await getPool().query(
      "insert into auth_users (id, email, password_hash, created_at) values ($1,$2,$3,$4)",
      [user.id, user.email, user.passwordHash, user.createdAt]
    );
    return { ok: true };
  } catch (error) {
    const message = toErrorMessage(error).toLowerCase();
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        ok: false,
        reason: "Email is already registered"
      };
    }
    throw error;
  }
}

async function createAuthSessionInPostgres(token: string, userId: string): Promise<void> {
  await ensurePostgresSchema();
  await getPool().query(
    "insert into auth_sessions (token, user_id, created_at) values ($1,$2, now())",
    [token, userId]
  );
}

async function getAuthSessionUserIdFromPostgres(token: string): Promise<string | null> {
  await ensurePostgresSchema();
  const result = await getPool().query<{
    user_id: string;
  }>(
    "select user_id from auth_sessions where token = $1 limit 1",
    [token]
  );
  return result.rows[0]?.user_id ?? null;
}

async function deleteAuthSessionInPostgres(token: string): Promise<void> {
  await ensurePostgresSchema();
  await getPool().query("delete from auth_sessions where token = $1", [token]);
}

export function getStorageInfo() {
  return {
    backend: activeBackend,
    fallbackReason
  };
}

function resolveUserId(userId?: string): string {
  return userId && userId.trim() ? userId : DEFAULT_USER_ID;
}

export async function readAppData(userId?: string): Promise<AppData> {
  const resolvedUserId = resolveUserId(userId);

  if (activeBackend === "postgres") {
    try {
      return await readAppDataFromPostgres(resolvedUserId);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return readAppDataFromFile(resolvedUserId);
}

export async function writeAppData(data: AppData, userId?: string): Promise<void> {
  const resolvedUserId = resolveUserId(userId);

  if (activeBackend === "postgres") {
    try {
      await writeAppDataToPostgres(resolvedUserId, data);
      return;
    } catch (error) {
      activateFileFallback(error);
    }
  }

  await writeAppDataToFile(resolvedUserId, data);
}

export async function resetAppData(userId?: string): Promise<AppData> {
  const resolvedUserId = resolveUserId(userId);

  if (activeBackend === "postgres") {
    try {
      return await resetAppDataInPostgres(resolvedUserId);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return resetAppDataInFile(resolvedUserId);
}

export async function createAuthUser(user: AuthUser): Promise<{ ok: boolean; reason?: string }> {
  const normalizedUser: AuthUser = {
    ...user,
    email: user.email.toLowerCase()
  };

  if (activeBackend === "postgres") {
    try {
      return await createAuthUserInPostgres(normalizedUser);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return createAuthUserInFile(normalizedUser);
}

export async function getAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const normalizedEmail = email.toLowerCase();

  if (activeBackend === "postgres") {
    try {
      return await getAuthUserByEmailFromPostgres(normalizedEmail);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return getAuthUserByEmailFromFile(normalizedEmail);
}

export async function getAuthUserById(userId: string): Promise<AuthPublicUser | null> {
  if (activeBackend === "postgres") {
    try {
      return await getAuthUserByIdFromPostgres(userId);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return getAuthUserByIdFromFile(userId);
}

export async function createAuthSession(token: string, userId: string): Promise<void> {
  if (activeBackend === "postgres") {
    try {
      await createAuthSessionInPostgres(token, userId);
      return;
    } catch (error) {
      activateFileFallback(error);
    }
  }

  await createAuthSessionInFile(token, userId);
}

export async function getAuthSessionUserId(token: string): Promise<string | null> {
  if (activeBackend === "postgres") {
    try {
      return await getAuthSessionUserIdFromPostgres(token);
    } catch (error) {
      activateFileFallback(error);
    }
  }

  return getAuthSessionUserIdFromFile(token);
}

export async function deleteAuthSession(token: string): Promise<void> {
  if (activeBackend === "postgres") {
    try {
      await deleteAuthSessionInPostgres(token);
      return;
    } catch (error) {
      activateFileFallback(error);
    }
  }

  await deleteAuthSessionInFile(token);
}

