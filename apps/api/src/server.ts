import cors from "cors";
import express from "express";
import { z } from "zod";

import { config } from "./config.js";

const workoutLogSchema = z.object({
  date: z.string().date(),
  workoutType: z.enum(["strength", "cardio", "mobility"]),
  durationMinutes: z.number().int().positive().max(300),
  notes: z.string().max(500).optional()
});

type WorkoutLog = z.infer<typeof workoutLogSchema>;
const workoutLogs: WorkoutLog[] = [];

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

  app.get("/api/v1/plans/sample", (_req, res) => {
    res.json({
      goal: "gain_muscle",
      weeklyPlan: [
        { day: "Monday", focus: "Upper body strength", durationMinutes: 60 },
        { day: "Wednesday", focus: "Lower body strength", durationMinutes: 60 },
        { day: "Friday", focus: "Full body + conditioning", durationMinutes: 50 }
      ],
      caloriesTarget: 2600
    });
  });

  app.get("/api/v1/workouts/logs", (_req, res) => {
    res.json({
      count: workoutLogs.length,
      data: workoutLogs
    });
  });

  app.post("/api/v1/workouts/logs", (req, res) => {
    const parsed = workoutLogSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid workout log payload",
        errors: parsed.error.flatten()
      });
      return;
    }

    workoutLogs.push(parsed.data);

    res.status(201).json({
      message: "Workout logged",
      data: parsed.data
    });
  });

  return app;
}

