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

export interface WeeklyPlanItem {
  day: string;
  focus: string;
  durationMinutes: number;
}

export interface SamplePlan {
  goal: string;
  weeklyPlan: WeeklyPlanItem[];
  caloriesTarget: number;
}

export interface AppData {
  profile: UserProfile | null;
  workouts: WorkoutLog[];
  nutritionByDate: Record<string, NutritionLog>;
  progressEntries: ProgressEntry[];
}

export interface WorkoutDraft {
  workoutType: WorkoutType;
  durationMinutes: number;
  notes?: string;
}

export interface ProgressDraft {
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
}

export type AppTab = "dashboard" | "workout" | "nutrition" | "progress";

