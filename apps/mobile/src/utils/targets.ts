import { FitnessGoal } from "../types";

export function calculateTargets(goal: FitnessGoal, weightKg: number) {
  const calorieFactor =
    goal === "gain_muscle" ? 36 :
    goal === "lose_weight" ? 28 :
    32;

  return {
    dailyCalorieTarget: Math.round(weightKg * calorieFactor),
    proteinTargetGrams: Math.round(weightKg * 1.8)
  };
}

