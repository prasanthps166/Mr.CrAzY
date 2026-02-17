import { FitnessGoal, WorkoutDraft, WorkoutLog, WorkoutType } from "../types";

type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core";

type VolumeStatus = "low" | "on_target" | "high";

interface TargetRange {
  min: number;
  max: number;
}

interface GoalTargets {
  weeklySets: Record<MuscleGroup, TargetRange>;
}

interface ExerciseHistoryPoint {
  sets: number;
  reps: number;
  weightKg?: number;
  workoutRpe?: number;
  date: string;
  createdAt: string;
}

export interface WeeklyVolumeSummary {
  group: MuscleGroup;
  label: string;
  sets: number;
  target: TargetRange;
  status: VolumeStatus;
}

export interface ScienceBasedInsight {
  weeklyVolume: WeeklyVolumeSummary[];
  focusMessage: string;
  recoveryMessage: string;
  progressionTips: string[];
}

export interface WorkoutDraftGuidance {
  targetRpe: TargetRange;
  targetDuration: TargetRange;
  sessionMessage: string;
  warnings: string[];
  progressionHints: string[];
}

const GROUP_ORDER: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core"];

const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core"
};

const GOAL_TARGETS: Record<FitnessGoal, GoalTargets> = {
  gain_muscle: {
    weeklySets: {
      chest: { min: 10, max: 18 },
      back: { min: 12, max: 20 },
      legs: { min: 12, max: 20 },
      shoulders: { min: 8, max: 16 },
      arms: { min: 8, max: 16 },
      core: { min: 6, max: 12 }
    }
  },
  lose_weight: {
    weeklySets: {
      chest: { min: 8, max: 14 },
      back: { min: 8, max: 16 },
      legs: { min: 8, max: 16 },
      shoulders: { min: 6, max: 12 },
      arms: { min: 6, max: 12 },
      core: { min: 4, max: 10 }
    }
  },
  maintain: {
    weeklySets: {
      chest: { min: 6, max: 12 },
      back: { min: 8, max: 14 },
      legs: { min: 8, max: 14 },
      shoulders: { min: 6, max: 10 },
      arms: { min: 6, max: 10 },
      core: { min: 4, max: 8 }
    }
  }
};

const DURATION_TARGETS: Record<WorkoutType, TargetRange> = {
  strength: { min: 45, max: 80 },
  cardio: { min: 25, max: 55 },
  mobility: { min: 20, max: 45 }
};

const RPE_TARGETS: Record<WorkoutType, Record<FitnessGoal, TargetRange>> = {
  strength: {
    gain_muscle: { min: 7, max: 9 },
    lose_weight: { min: 6.5, max: 8.5 },
    maintain: { min: 6.5, max: 8.5 }
  },
  cardio: {
    gain_muscle: { min: 6, max: 8 },
    lose_weight: { min: 6.5, max: 8.5 },
    maintain: { min: 6, max: 8 }
  },
  mobility: {
    gain_muscle: { min: 4, max: 6 },
    lose_weight: { min: 4, max: 6 },
    maintain: { min: 4, max: 6 }
  }
};

const EXERCISE_PATTERNS: Array<{ pattern: RegExp; groups: MuscleGroup[] }> = [
  { pattern: /(bench|chest\s*(press|fly)|pec|push[\s-]?up|dip)/i, groups: ["chest"] },
  { pattern: /(row|pull[\s-]?up|chin[\s-]?up|pulldown|lat)/i, groups: ["back"] },
  { pattern: /(squat|lunge|leg\s*press|deadlift|rdl|hamstring|quad|calf|hip\s*thrust)/i, groups: ["legs"] },
  { pattern: /(overhead\s*press|shoulder\s*press|lateral\s*raise|rear\s*delt|face\s*pull|arnold\s*press)/i, groups: ["shoulders"] },
  { pattern: /(curl|triceps|pushdown|skullcrusher|extension)/i, groups: ["arms"] },
  { pattern: /(plank|crunch|ab|core|pallof|hanging\s*leg)/i, groups: ["core"] }
];

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isWithinLastDays(dateKey: string, referenceDate: Date, days: number): boolean {
  const date = startOfDay(parseDateKey(dateKey));
  const end = startOfDay(referenceDate);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return date >= start && date <= end;
}

function keyExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatExerciseName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Exercise";
  }
  return trimmed
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function classifyExercise(name: string): MuscleGroup[] {
  const groups = new Set<MuscleGroup>();
  for (const matcher of EXERCISE_PATTERNS) {
    if (matcher.pattern.test(name)) {
      for (const group of matcher.groups) {
        groups.add(group);
      }
    }
  }
  return Array.from(groups);
}

function toSortedRecentWorkouts(workouts: WorkoutLog[]): WorkoutLog[] {
  return [...workouts].sort((a, b) => {
    if (a.date === b.date) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.date.localeCompare(a.date);
  });
}

function buildExerciseHistory(workouts: WorkoutLog[], referenceDate: Date): Map<string, ExerciseHistoryPoint[]> {
  const history = new Map<string, ExerciseHistoryPoint[]>();

  const recentStrength = toSortedRecentWorkouts(workouts).filter(
    (workout) => workout.workoutType === "strength" && isWithinLastDays(workout.date, referenceDate, 42)
  );

  for (const workout of recentStrength) {
    for (const exercise of workout.exerciseEntries ?? []) {
      const key = keyExerciseName(exercise.name);
      if (!key) {
        continue;
      }
      const next: ExerciseHistoryPoint = {
        sets: exercise.sets,
        reps: exercise.reps,
        weightKg: exercise.weightKg,
        workoutRpe: workout.intensityRpe,
        date: workout.date,
        createdAt: workout.createdAt
      };
      const existing = history.get(key);
      if (existing) {
        existing.push(next);
      } else {
        history.set(key, [next]);
      }
    }
  }

  return history;
}

function buildWeeklyVolume(goal: FitnessGoal, workouts: WorkoutLog[], referenceDate: Date): WeeklyVolumeSummary[] {
  const counts: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    legs: 0,
    shoulders: 0,
    arms: 0,
    core: 0
  };

  const recentStrength = workouts.filter(
    (workout) => workout.workoutType === "strength" && isWithinLastDays(workout.date, referenceDate, 7)
  );

  for (const workout of recentStrength) {
    for (const exercise of workout.exerciseEntries ?? []) {
      const groups = classifyExercise(exercise.name);
      if (!groups.length) {
        continue;
      }
      const sets = Number.isFinite(exercise.sets) ? Math.max(1, Math.round(exercise.sets)) : 0;
      for (const group of groups) {
        counts[group] += sets;
      }
    }
  }

  return GROUP_ORDER.map((group) => {
    const target = GOAL_TARGETS[goal].weeklySets[group];
    const sets = counts[group];
    const status: VolumeStatus =
      sets < target.min
        ? "low"
        : sets > target.max
          ? "high"
          : "on_target";

    return {
      group,
      label: GROUP_LABELS[group],
      sets,
      target,
      status
    };
  });
}

function buildFocusMessage(goal: FitnessGoal, weeklyVolume: WeeklyVolumeSummary[]): string {
  const low = weeklyVolume.filter((item) => item.status === "low");
  if (low.length) {
    const labels = low.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ");
    if (goal === "gain_muscle") {
      return `Increase weekly hard sets for ${labels} by 2-4 to stay in hypertrophy landmarks.`;
    }
    if (goal === "lose_weight") {
      return `Keep ${labels} in moderate volume so strength stays stable while cutting.`;
    }
    return `Raise ${labels} slightly to stay above maintenance volume.`;
  }

  const high = weeklyVolume.filter((item) => item.status === "high");
  if (high.length) {
    const labels = high.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ");
    return `Volume is high for ${labels}; consider trimming 2-3 sets to improve recovery quality.`;
  }

  return "Weekly volume sits in target ranges. Keep progressive overload steady with clean technique.";
}

function dayDiff(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / msPerDay);
}

function getRecentConsecutiveTrainingDays(workouts: WorkoutLog[], referenceDate: Date): number {
  const recentDates = Array.from(
    new Set(
      workouts
        .filter((workout) => isWithinLastDays(workout.date, referenceDate, 7))
        .map((workout) => workout.date)
    )
  ).sort((a, b) => b.localeCompare(a));

  if (!recentDates.length) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < recentDates.length; index += 1) {
    const current = parseDateKey(recentDates[index - 1]);
    const previous = parseDateKey(recentDates[index]);
    if (dayDiff(current, previous) === 1) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function buildRecoveryMessage(goal: FitnessGoal, workouts: WorkoutLog[], referenceDate: Date): string {
  const recent = workouts.filter((workout) => isWithinLastDays(workout.date, referenceDate, 7));
  const sessions = recent.length;
  const rpeValues = recent.flatMap((workout) =>
    workout.intensityRpe !== undefined ? [workout.intensityRpe] : []
  );
  const avgRpe = rpeValues.length
    ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
    : 0;
  const consecutiveDays = getRecentConsecutiveTrainingDays(workouts, referenceDate);

  if (sessions >= 5 && avgRpe >= 8.5) {
    return "Fatigue flag: 5+ sessions with high effort this week. Run a 4-7 day deload at ~60% normal volume.";
  }
  if (consecutiveDays >= 4) {
    return "You logged 4+ consecutive training days. Add a lighter day or rest day to protect performance.";
  }
  if (goal === "lose_weight" && avgRpe >= 8.2) {
    return "During a cut, keep most sets around RPE 7-8 and limit all-out sets to preserve recovery.";
  }
  return "Recovery demand looks manageable. Prioritize sleep and keep 1-3 reps in reserve on most sets.";
}

function buildProgressionTips(workouts: WorkoutLog[], referenceDate: Date, maxTips = 3): string[] {
  const history = buildExerciseHistory(workouts, referenceDate);

  const entries = Array.from(history.entries()).sort((a, b) => b[1].length - a[1].length);
  const tips: string[] = [];

  for (const [key, points] of entries) {
    if (tips.length >= maxTips) {
      break;
    }
    if (points.length < 2) {
      continue;
    }

    const current = points[0];
    const previous = points[1];
    const name = formatExerciseName(key);

    const currentVolume = current.sets * current.reps * (current.weightKg ?? 1);
    const previousVolume = previous.sets * previous.reps * (previous.weightKg ?? 1);

    if (
      current.weightKg !== undefined &&
      previous.weightKg !== undefined &&
      current.weightKg > previous.weightKg &&
      current.reps >= previous.reps
    ) {
      tips.push(`${name}: loading is trending up. Keep this lift in an RPE 7-9 range and add 2.5-5% only when reps stay strong.`);
      continue;
    }

    if (
      current.weightKg !== undefined &&
      previous.weightKg !== undefined &&
      current.weightKg === previous.weightKg &&
      current.reps > previous.reps
    ) {
      tips.push(`${name}: reps improved at the same load. Use double progression and add small load next time.`);
      continue;
    }

    if (
      current.weightKg !== undefined &&
      previous.weightKg !== undefined &&
      (current.weightKg <= previous.weightKg * 0.95 || current.reps + 2 < previous.reps)
    ) {
      tips.push(`${name}: performance dipped. Hold load steady and reduce weekly sets slightly until reps stabilize.`);
      continue;
    }

    if ((current.workoutRpe ?? 0) >= 9 && (previous.workoutRpe ?? 0) >= 9 && currentVolume <= previousVolume) {
      tips.push(`${name}: high effort with flat output suggests a plateau. Keep 1-2 reps in reserve and progress more gradually.`);
      continue;
    }
  }

  if (!tips.length) {
    return [
      "Use double progression: add reps first, then increase load by 2.5-5% once top reps are repeatable.",
      "Keep most hard sets at RPE 7-9 to build volume without stalling recovery."
    ];
  }

  return tips;
}

function roundToOne(value: number): number {
  return Number(value.toFixed(1));
}

function buildExerciseHint(
  exerciseName: string,
  draft: WorkoutDraft,
  history: Map<string, ExerciseHistoryPoint[]>
): string | null {
  const key = keyExerciseName(exerciseName);
  const points = history.get(key);
  if (!points || points.length === 0) {
    return `${formatExerciseName(exerciseName)}: start near RPE 7 and add reps before adding load.`;
  }

  const latest = points[0];
  const latestWeight = latest.weightKg;
  const latestReps = latest.reps;
  const currentRpe = draft.intensityRpe;

  if (latestWeight === undefined) {
    return `${formatExerciseName(exerciseName)}: last log was ${latestReps} reps. Beat that by 1 rep before adding set count.`;
  }

  const suggestedTop = roundToOne(latestWeight * 1.05);
  if (currentRpe !== undefined && currentRpe > 9) {
    return `${formatExerciseName(exerciseName)}: effort is already high. Stay near ${latestWeight} kg and improve reps before loading up.`;
  }

  return `${formatExerciseName(exerciseName)}: last was ${latestWeight} kg x ${latestReps}. If form is solid today, a ${latestWeight}-${suggestedTop} kg range is appropriate.`;
}

function formatRpe(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getScienceBasedInsight(
  goal: FitnessGoal,
  workouts: WorkoutLog[],
  referenceDate: Date = new Date()
): ScienceBasedInsight {
  const weeklyVolume = buildWeeklyVolume(goal, workouts, referenceDate);

  return {
    weeklyVolume,
    focusMessage: buildFocusMessage(goal, weeklyVolume),
    recoveryMessage: buildRecoveryMessage(goal, workouts, referenceDate),
    progressionTips: buildProgressionTips(workouts, referenceDate)
  };
}

export function getWorkoutDraftGuidance(
  goal: FitnessGoal,
  draft: WorkoutDraft,
  workouts: WorkoutLog[],
  referenceDate: Date = new Date()
): WorkoutDraftGuidance {
  const targetRpe = RPE_TARGETS[draft.workoutType][goal];
  const targetDuration = DURATION_TARGETS[draft.workoutType];
  const warnings: string[] = [];

  const totalSets = draft.exerciseEntries.reduce((sum, entry) => sum + Math.max(0, entry.sets), 0);

  if (draft.intensityRpe !== undefined) {
    if (draft.intensityRpe < targetRpe.min) {
      warnings.push(
        `Current effort is below the target range (RPE ${formatRpe(targetRpe.min)}-${formatRpe(targetRpe.max)}).`
      );
    } else if (draft.intensityRpe > targetRpe.max) {
      warnings.push(
        `Current effort is above the target range (RPE ${formatRpe(targetRpe.min)}-${formatRpe(targetRpe.max)}).`
      );
    }
  }

  if (draft.durationMinutes > 0) {
    if (draft.durationMinutes < targetDuration.min) {
      warnings.push(`Session duration is shorter than the recommended ${targetDuration.min}-${targetDuration.max} minute range.`);
    } else if (draft.durationMinutes > targetDuration.max) {
      warnings.push(`Session duration is longer than the recommended ${targetDuration.min}-${targetDuration.max} minute range.`);
    }
  }

  if (draft.workoutType === "strength") {
    if (draft.exerciseEntries.length < 2) {
      warnings.push("Include at least 2-4 exercises to cover compounds plus accessories.");
    }
    if (totalSets > 26) {
      warnings.push("Total set count is high for one strength session; quality may drop late in the workout.");
    }
  }

  if (draft.workoutType === "mobility" && draft.intensityRpe !== undefined && draft.intensityRpe > 7) {
    warnings.push("Mobility work should stay easier so it improves movement quality instead of adding fatigue.");
  }

  const history = buildExerciseHistory(workouts, referenceDate);
  const progressionHints = draft.exerciseEntries
    .slice(0, 3)
    .map((entry) => buildExerciseHint(entry.name, draft, history))
    .flatMap((value) => (value ? [value] : []));

  const sessionMessage =
    draft.workoutType === "strength"
      ? "Use controlled reps, keep 1-3 reps in reserve on most sets, and only push near failure on the last set."
      : draft.workoutType === "cardio"
        ? "Mix easier zone-2 work with short harder intervals so conditioning improves without compromising recovery."
        : "Keep movement smooth and pain-free, emphasizing range and control over effort.";

  return {
    targetRpe,
    targetDuration,
    sessionMessage,
    warnings,
    progressionHints
  };
}
