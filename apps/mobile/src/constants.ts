import { FitnessGoal, WorkoutType } from "./types";

export const GOAL_LABELS: Record<FitnessGoal, string> = {
  lose_weight: "Lose Weight",
  gain_muscle: "Gain Muscle",
  maintain: "Maintain"
};

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility"
};

export const GOAL_DESCRIPTIONS: Record<FitnessGoal, string> = {
  lose_weight: "Steady fat loss with muscle retention",
  gain_muscle: "Progressive overload and calorie surplus",
  maintain: "Balanced performance and body composition"
};

export const FALLBACK_PLANS: Record<FitnessGoal, Array<{ day: string; focus: string; durationMinutes: number }>> = {
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

