import cors from "cors";
import express from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";

import { config } from "./config.js";
import {
  createAuthSession,
  createAuthUser,
  deleteAuthSession,
  getAuthSessionUserId,
  getAuthUserByEmail,
  getAuthUserById,
  getStorageInfo,
  resetAppData,
  readAppData,
  type AppData,
  type AuthUser,
  type FitnessGoal,
  type WorkoutLog as StoredWorkoutLog,
  writeAppData
} from "./store.js";

const workoutLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  workoutType: z.enum(["strength", "cardio", "mobility"]),
  durationMinutes: z.number().int().positive().max(300),
  notes: z.string().max(500).optional(),
  createdAt: z.string().datetime().optional(),
  syncedAt: z.string().datetime().nullable().optional()
});

type WorkoutPayload = z.infer<typeof workoutLogSchema>;

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(12).max(90),
  heightCm: z.number().int().min(120).max(230),
  currentWeightKg: z.number().positive().max(220),
  goal: z.enum(["lose_weight", "gain_muscle", "maintain"]),
  dailyCalorieTarget: z.number().int().positive(),
  proteinTargetGrams: z.number().int().positive()
});

const nutritionLogSchema = z.object({
  date: z.string().date(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  waterLiters: z.number().min(0)
});

const progressEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  weightKg: z.number().positive().max(220),
  bodyFatPct: z.number().min(2).max(70).optional(),
  waistCm: z.number().min(40).max(180).optional()
});

const authRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(120)
});

const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(120)
});

const goalPlanMap: Record<FitnessGoal, Array<{ day: string; focus: string; durationMinutes: number }>> = {
  lose_weight: [
    { day: "Monday", focus: "Lower body + incline walk", durationMinutes: 55 },
    { day: "Wednesday", focus: "Upper body circuit", durationMinutes: 50 },
    { day: "Friday", focus: "Full body strength", durationMinutes: 60 },
    { day: "Saturday", focus: "Zone-2 cardio", durationMinutes: 40 }
  ],
  gain_muscle: [
    { day: "Monday", focus: "Push day", durationMinutes: 65 },
    { day: "Tuesday", focus: "Pull day", durationMinutes: 65 },
    { day: "Thursday", focus: "Leg day", durationMinutes: 70 },
    { day: "Saturday", focus: "Accessory + core", durationMinutes: 50 }
  ],
  maintain: [
    { day: "Monday", focus: "Full body strength", durationMinutes: 55 },
    { day: "Wednesday", focus: "HIIT + core", durationMinutes: 40 },
    { day: "Friday", focus: "Mobility + easy cardio", durationMinutes: 45 }
  ]
};

function replaceOrPushWorkout(data: AppData, workout: StoredWorkoutLog) {
  const index = data.workouts.findIndex((entry) => entry.id === workout.id);
  if (index === -1) {
    data.workouts.unshift(workout);
    return;
  }
  data.workouts[index] = workout;
}

function replaceOrPushProgress(data: AppData, entry: z.infer<typeof progressEntrySchema>) {
  const index = data.progressEntries.findIndex((item) => item.id === entry.id);
  if (index === -1) {
    data.progressEntries.unshift(entry);
    return;
  }
  data.progressEntries[index] = entry;
}

function sortData(data: AppData): AppData {
  return {
    ...data,
    workouts: [...data.workouts].sort((a, b) => {
      if (a.date === b.date) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.date.localeCompare(a.date);
    }),
    progressEntries: [...data.progressEntries].sort((a, b) => b.date.localeCompare(a.date))
  };
}

function createUserId(): string {
  return `usr_${Date.now()}_${randomBytes(5).toString("hex")}`;
}

function createAuthToken(): string {
  return randomBytes(24).toString("hex");
}

function hashPassword(password: string, salt?: string): string {
  const resolvedSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, resolvedSalt, 32).toString("hex");
  return `${resolvedSalt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const calculatedHash = scryptSync(password, salt, 32).toString("hex");
  const storedBytes = Buffer.from(storedHash, "hex");
  const calculatedBytes = Buffer.from(calculatedHash, "hex");

  if (storedBytes.length !== calculatedBytes.length) {
    return false;
  }

  return timingSafeEqual(storedBytes, calculatedBytes);
}

type AuthMode = "allow-local-fallback" | "require-token";

async function resolveRequestUserId(req: Request, res: Response, mode: AuthMode): Promise<string | null> {
  const authHeader = req.header("authorization");

  if (!authHeader) {
    if (mode === "allow-local-fallback") {
      return "local-user";
    }
    res.status(401).json({ message: "Missing authorization token" });
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Invalid authorization format" });
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ message: "Missing authorization token" });
    return null;
  }

  const userId = await getAuthSessionUserId(token);
  if (!userId) {
    res.status(401).json({ message: "Session is invalid or expired" });
    return null;
  }

  return userId;
}

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const storage = getStorageInfo();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      storage
    });
  });

  app.post("/api/v1/auth/register", async (req, res) => {
    const parsed = authRegisterSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid register payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const userId = createUserId();
    const createdAt = new Date().toISOString();
    const authUser: AuthUser = {
      id: userId,
      email,
      passwordHash: hashPassword(parsed.data.password),
      createdAt
    };

    const created = await createAuthUser(authUser);
    if (!created.ok) {
      res.status(409).json({
        message: created.reason ?? "Registration failed"
      });
      return;
    }

    await resetAppData(userId);

    const token = createAuthToken();
    await createAuthSession(token, userId);

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        createdAt
      }
    });
  });

  app.post("/api/v1/auth/login", async (req, res) => {
    const parsed = authLoginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid login payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const authUser = await getAuthUserByEmail(email);

    if (!authUser || !verifyPassword(parsed.data.password, authUser.passwordHash)) {
      res.status(401).json({
        message: "Invalid email or password"
      });
      return;
    }

    const token = createAuthToken();
    await createAuthSession(token, authUser.id);

    res.json({
      token,
      user: {
        id: authUser.id,
        email: authUser.email,
        createdAt: authUser.createdAt
      }
    });
  });

  app.get("/api/v1/auth/me", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "require-token");
    if (!userId) {
      return;
    }

    const user = await getAuthUserById(userId);
    if (!user) {
      res.status(401).json({
        message: "Session is invalid"
      });
      return;
    }

    res.json({
      user
    });
  });

  app.post("/api/v1/auth/logout", async (req, res) => {
    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(204).send();
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      await deleteAuthSession(token);
    }

    res.status(204).send();
  });

  app.get("/api/v1/sync/snapshot", async (_req, res) => {
    const userId = await resolveRequestUserId(_req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = await readAppData(userId);
    res.json(sortData(data));
  });

  app.delete("/api/v1/sync/data", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = await resetAppData(userId);
    res.json({
      message: "Data reset complete",
      data
    });
  });

  app.put("/api/v1/profile", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid profile payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const data = await readAppData(userId);
    data.profile = parsed.data;
    await writeAppData(data, userId);
    res.json({ data: data.profile });
  });

  app.get("/api/v1/profile", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = await readAppData(userId);
    res.json({ data: data.profile });
  });

  app.get("/api/v1/plans/sample", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = await readAppData(userId);
    const goalQuery = req.query.goal;
    const goal =
      goalQuery === "lose_weight" || goalQuery === "gain_muscle" || goalQuery === "maintain"
        ? goalQuery
        : data.profile?.goal ?? "maintain";

    res.json({
      goal,
      weeklyPlan: goalPlanMap[goal],
      caloriesTarget: data.profile?.dailyCalorieTarget ?? 2400
    });
  });

  app.get("/api/v1/workouts/logs", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = sortData(await readAppData(userId));
    res.json({
      count: data.workouts.length,
      data: data.workouts
    });
  });

  app.post("/api/v1/workouts/logs", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const parsed = workoutLogSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid workout log payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = parsed.data;
    const data = await readAppData(userId);

    const normalizedWorkout: StoredWorkoutLog = {
      ...payload,
      createdAt: payload.createdAt ?? nowIso,
      syncedAt: nowIso
    };

    replaceOrPushWorkout(data, normalizedWorkout);
    await writeAppData(sortData(data), userId);

    res.status(201).json({
      message: "Workout logged",
      data: normalizedWorkout
    });
  });

  app.delete("/api/v1/workouts/logs/:id", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const id = req.params.id;
    const data = await readAppData(userId);
    const initialCount = data.workouts.length;
    data.workouts = data.workouts.filter((entry) => entry.id !== id);
    await writeAppData(sortData(data), userId);

    res.json({
      message: initialCount === data.workouts.length ? "Workout not found" : "Workout deleted",
      id
    });
  });

  app.get("/api/v1/nutrition/logs", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = await readAppData(userId);
    res.json({
      count: Object.keys(data.nutritionByDate).length,
      data: data.nutritionByDate
    });
  });

  app.put("/api/v1/nutrition/logs/:date", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const date = req.params.date;
    const parsed = nutritionLogSchema.safeParse({
      ...req.body,
      date
    });

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid nutrition payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const data = await readAppData(userId);
    data.nutritionByDate[date] = parsed.data;
    await writeAppData(data, userId);

    res.json({
      message: "Nutrition updated",
      data: parsed.data
    });
  });

  app.delete("/api/v1/nutrition/logs/:date", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const date = req.params.date;
    const dateParsed = z.string().date().safeParse(date);

    if (!dateParsed.success) {
      res.status(400).json({
        message: "Invalid date"
      });
      return;
    }

    const data = await readAppData(userId);
    const hadValue = Object.hasOwn(data.nutritionByDate, date);
    if (hadValue) {
      delete data.nutritionByDate[date];
      await writeAppData(data, userId);
    }

    res.json({
      message: hadValue ? "Nutrition deleted" : "Nutrition not found",
      date
    });
  });

  app.get("/api/v1/progress/entries", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const data = sortData(await readAppData(userId));
    res.json({
      count: data.progressEntries.length,
      data: data.progressEntries
    });
  });

  app.post("/api/v1/progress/entries", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const parsed = progressEntrySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid progress payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const data = await readAppData(userId);
    replaceOrPushProgress(data, parsed.data);
    await writeAppData(sortData(data), userId);

    res.status(201).json({
      message: "Progress logged",
      data: parsed.data
    });
  });

  app.delete("/api/v1/progress/entries/:id", async (req, res) => {
    const userId = await resolveRequestUserId(req, res, "allow-local-fallback");
    if (!userId) {
      return;
    }

    const id = req.params.id;
    const data = await readAppData(userId);
    const initialCount = data.progressEntries.length;
    data.progressEntries = data.progressEntries.filter((entry) => entry.id !== id);
    await writeAppData(sortData(data), userId);

    res.json({
      message: initialCount === data.progressEntries.length ? "Progress not found" : "Progress deleted",
      id
    });
  });

  return app;
}

