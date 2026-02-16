export type FitnessGoal = "lose_weight" | "gain_muscle" | "maintain";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: FitnessGoal;
}

export interface WorkoutSession {
  id: string;
  date: string;
  workoutType: "strength" | "cardio" | "mobility";
  durationMinutes: number;
  notes?: string;
}

