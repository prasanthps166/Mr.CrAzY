import { WorkoutLog } from "../types";

export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function getWeeklyWorkoutCount(workouts: WorkoutLog[], reference: Date = new Date()): number {
  const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const day = end.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(end);
  start.setDate(end.getDate() - diffToMonday);

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  return workouts.filter((entry) => entry.date >= startKey && entry.date <= endKey).length;
}

export function getWorkoutStreak(workouts: WorkoutLog[], reference: Date = new Date()): number {
  const workoutDays = new Set(workouts.map((entry) => entry.date));
  let streak = 0;
  const cursor = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  while (workoutDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

