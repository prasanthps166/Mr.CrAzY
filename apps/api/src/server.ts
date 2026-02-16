import cors from "cors";
import express from "express";
import { z } from "zod";

import { config } from "./config.js";
import {
  readAppData,
  type AppData,
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

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/v1/sync/snapshot", async (_req, res) => {
    const data = await readAppData();
    res.json(sortData(data));
  });

  app.put("/api/v1/profile", async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid profile payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const data = await readAppData();
    data.profile = parsed.data;
    await writeAppData(data);
    res.json({ data: data.profile });
  });

  app.get("/api/v1/profile", async (_req, res) => {
    const data = await readAppData();
    res.json({ data: data.profile });
  });

  app.get("/api/v1/plans/sample", async (req, res) => {
    const data = await readAppData();
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

  app.get("/api/v1/workouts/logs", async (_req, res) => {
    const data = sortData(await readAppData());
    res.json({
      count: data.workouts.length,
      data: data.workouts
    });
  });

  app.post("/api/v1/workouts/logs", async (req, res) => {
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
    const data = await readAppData();

    const normalizedWorkout: StoredWorkoutLog = {
      ...payload,
      createdAt: payload.createdAt ?? nowIso,
      syncedAt: nowIso
    };

    replaceOrPushWorkout(data, normalizedWorkout);
    await writeAppData(sortData(data));

    res.status(201).json({
      message: "Workout logged",
      data: normalizedWorkout
    });
  });

  app.get("/api/v1/nutrition/logs", async (_req, res) => {
    const data = await readAppData();
    res.json({
      count: Object.keys(data.nutritionByDate).length,
      data: data.nutritionByDate
    });
  });

  app.put("/api/v1/nutrition/logs/:date", async (req, res) => {
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

    const data = await readAppData();
    data.nutritionByDate[date] = parsed.data;
    await writeAppData(data);

    res.json({
      message: "Nutrition updated",
      data: parsed.data
    });
  });

  app.get("/api/v1/progress/entries", async (_req, res) => {
    const data = sortData(await readAppData());
    res.json({
      count: data.progressEntries.length,
      data: data.progressEntries
    });
  });

  app.post("/api/v1/progress/entries", async (req, res) => {
    const parsed = progressEntrySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid progress payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    const data = await readAppData();
    replaceOrPushProgress(data, parsed.data);
    await writeAppData(sortData(data));

    res.status(201).json({
      message: "Progress logged",
      data: parsed.data
    });
  });

  return app;
}

