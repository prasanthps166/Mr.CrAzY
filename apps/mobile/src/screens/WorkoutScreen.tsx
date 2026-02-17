import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { WORKOUT_TYPE_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { FitnessGoal, WorkoutDraft, WorkoutExerciseEntry, WorkoutLog, WorkoutType } from "../types";
import { formatDateLabel } from "../utils/date";
import { getWorkoutDraftGuidance } from "../utils/scienceTraining";

interface WorkoutScreenProps {
  goal: FitnessGoal;
  workouts: WorkoutLog[];
  onCreateWorkout: (draft: WorkoutDraft) => Promise<void>;
  onUpdateWorkout: (id: string, draft: WorkoutDraft) => Promise<void>;
  onDeleteWorkout: (id: string) => void;
}

interface ExerciseDraftRow {
  id: string;
  name: string;
  setsText: string;
  repsText: string;
  weightText: string;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  workoutType: WorkoutType;
  durationMinutes: number;
  exerciseEntries: WorkoutExerciseEntry[];
  intensityRpe?: number;
  caloriesBurned?: number;
  notes?: string;
}

const TEMPLATE_STORAGE_KEY = "@fittrack/workout-templates/v1";

const BUILTIN_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "tmpl_builtin_push",
    name: "Push Day",
    workoutType: "strength",
    durationMinutes: 65,
    intensityRpe: 8,
    exerciseEntries: [
      { id: "push_ex_1", name: "Barbell Bench Press", sets: 4, reps: 6, weightKg: 70 },
      { id: "push_ex_2", name: "Incline Dumbbell Press", sets: 3, reps: 10, weightKg: 26 },
      { id: "push_ex_3", name: "Triceps Pushdown", sets: 3, reps: 12 }
    ],
    notes: "Focus on steady reps and full lockout."
  },
  {
    id: "tmpl_builtin_pull",
    name: "Pull Day",
    workoutType: "strength",
    durationMinutes: 65,
    intensityRpe: 8,
    exerciseEntries: [
      { id: "pull_ex_1", name: "Lat Pulldown", sets: 4, reps: 8, weightKg: 55 },
      { id: "pull_ex_2", name: "Chest Supported Row", sets: 3, reps: 10, weightKg: 42 },
      { id: "pull_ex_3", name: "Dumbbell Curl", sets: 3, reps: 12, weightKg: 12 }
    ],
    notes: "Pause on contraction and avoid momentum."
  },
  {
    id: "tmpl_builtin_legs",
    name: "Leg Day",
    workoutType: "strength",
    durationMinutes: 70,
    intensityRpe: 8.5,
    exerciseEntries: [
      { id: "legs_ex_1", name: "Back Squat", sets: 4, reps: 5, weightKg: 90 },
      { id: "legs_ex_2", name: "Romanian Deadlift", sets: 3, reps: 8, weightKg: 80 },
      { id: "legs_ex_3", name: "Walking Lunges", sets: 3, reps: 12, weightKg: 14 }
    ],
    notes: "Brace hard and maintain range of motion."
  }
];

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createExerciseRow(partial: Partial<ExerciseDraftRow> = {}): ExerciseDraftRow {
  return {
    id: partial.id ?? createId("ex"),
    name: partial.name ?? "",
    setsText: partial.setsText ?? "",
    repsText: partial.repsText ?? "",
    weightText: partial.weightText ?? ""
  };
}

function mapExercisesToRows(entries: WorkoutExerciseEntry[]): ExerciseDraftRow[] {
  if (!entries.length) {
    return [createExerciseRow()];
  }
  return entries.map((entry) =>
    createExerciseRow({
      id: entry.id,
      name: entry.name,
      setsText: String(entry.sets),
      repsText: String(entry.reps),
      weightText: entry.weightKg !== undefined ? String(entry.weightKg) : ""
    })
  );
}

function parseTemplate(input: unknown): WorkoutTemplate | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Partial<WorkoutTemplate>;
  if (typeof row.name !== "string" || !row.name.trim()) {
    return null;
  }
  if (row.workoutType !== "strength" && row.workoutType !== "cardio" && row.workoutType !== "mobility") {
    return null;
  }

  const duration = Number(row.durationMinutes);
  if (!Number.isFinite(duration) || duration < 5 || duration > 300) {
    return null;
  }

  const exercises = Array.isArray(row.exerciseEntries)
    ? row.exerciseEntries.flatMap((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const sets = Number(entry.sets);
        const reps = Number(entry.reps);
        if (!entry.name || !Number.isFinite(sets) || !Number.isFinite(reps) || sets < 1 || reps < 1) {
          return [];
        }
        const weight = Number(entry.weightKg);
        return [
          {
            id: typeof entry.id === "string" && entry.id.trim() ? entry.id : `${row.name}_${index}`,
            name: String(entry.name).trim(),
            sets: Math.round(sets),
            reps: Math.round(reps),
            weightKg: Number.isFinite(weight) && weight >= 0 ? weight : undefined
          }
        ];
      })
    : [];

  const intensity = Number(row.intensityRpe);
  const calories = Number(row.caloriesBurned);

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id : createId("tmpl"),
    name: row.name.trim(),
    workoutType: row.workoutType,
    durationMinutes: Math.round(duration),
    exerciseEntries: exercises,
    intensityRpe: Number.isFinite(intensity) && intensity >= 1 && intensity <= 10
      ? Number(intensity.toFixed(1))
      : undefined,
    caloriesBurned: Number.isFinite(calories) && calories >= 0 ? Math.round(calories) : undefined,
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : undefined
  };
}

function toRpeText(rpe: number | undefined): string {
  if (rpe === undefined) {
    return "";
  }
  return Number.isInteger(rpe) ? String(rpe) : rpe.toFixed(1);
}

export function WorkoutScreen({
  goal,
  workouts,
  onCreateWorkout,
  onUpdateWorkout,
  onDeleteWorkout
}: WorkoutScreenProps) {
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [durationText, setDurationText] = useState("45");
  const [intensityRpeText, setIntensityRpeText] = useState("");
  const [caloriesBurnedText, setCaloriesBurnedText] = useState("");
  const [templateNameText, setTemplateNameText] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseRows, setExerciseRows] = useState<ExerciseDraftRow[]>([createExerciseRow()]);
  const [customTemplates, setCustomTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recentWorkouts = useMemo(() => workouts.slice(0, 8), [workouts]);
  const templates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates]);
  const draftPreview = useMemo<WorkoutDraft>(() => {
    const duration = Number(durationText);
    const intensity = Number(intensityRpeText);
    const calories = Number(caloriesBurnedText);

    const exerciseEntries = exerciseRows.flatMap((row) => {
      const name = row.name.trim();
      const sets = Number(row.setsText);
      const reps = Number(row.repsText);
      const weight = Number(row.weightText);

      if (!name || !Number.isFinite(sets) || !Number.isFinite(reps) || sets < 1 || reps < 1) {
        return [];
      }

      return [
        {
          id: row.id,
          name,
          sets: Math.round(sets),
          reps: Math.round(reps),
          weightKg: Number.isFinite(weight) && weight >= 0 ? Number(weight.toFixed(1)) : undefined
        }
      ];
    });

    return {
      workoutType,
      durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
      exerciseEntries,
      intensityRpe: Number.isFinite(intensity) ? Number(intensity.toFixed(1)) : undefined,
      caloriesBurned: Number.isFinite(calories) ? Math.round(calories) : undefined,
      templateName: templateNameText.trim() ? templateNameText.trim() : undefined,
      notes: notes.trim() ? notes.trim() : undefined
    };
  }, [caloriesBurnedText, durationText, exerciseRows, intensityRpeText, notes, templateNameText, workoutType]);
  const scienceGuidance = useMemo(
    () => getWorkoutDraftGuidance(goal, draftPreview, workouts),
    [draftPreview, goal, workouts]
  );

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(TEMPLATE_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as unknown[];
        if (!Array.isArray(parsed)) {
          return;
        }
        const next = parsed.flatMap((item) => {
          const template = parseTemplate(item);
          return template ? [template] : [];
        });
        setCustomTemplates(next);
      } catch (_error) {
        // Ignore template read issues and continue with built-ins.
      } finally {
        setTemplatesLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!templatesLoaded) {
      return;
    }
    AsyncStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(customTemplates)).catch(() => {
      // Non-blocking save.
    });
  }, [customTemplates, templatesLoaded]);

  function resetForm() {
    setWorkoutType("strength");
    setDurationText("45");
    setIntensityRpeText("");
    setCaloriesBurnedText("");
    setTemplateNameText("");
    setNotes("");
    setExerciseRows([createExerciseRow()]);
    setEditingWorkoutId(null);
    setError(null);
  }

  function startEdit(entry: WorkoutLog) {
    setWorkoutType(entry.workoutType);
    setDurationText(String(entry.durationMinutes));
    setIntensityRpeText(toRpeText(entry.intensityRpe));
    setCaloriesBurnedText(entry.caloriesBurned !== undefined ? String(entry.caloriesBurned) : "");
    setTemplateNameText(entry.templateName ?? "");
    setNotes(entry.notes ?? "");
    setExerciseRows(mapExercisesToRows(entry.exerciseEntries ?? []));
    setEditingWorkoutId(entry.id);
    setError(null);
  }

  function applyTemplate(template: WorkoutTemplate) {
    setWorkoutType(template.workoutType);
    setDurationText(String(template.durationMinutes));
    setIntensityRpeText(toRpeText(template.intensityRpe));
    setCaloriesBurnedText(template.caloriesBurned !== undefined ? String(template.caloriesBurned) : "");
    setTemplateNameText(template.name);
    setNotes(template.notes ?? "");
    setExerciseRows(mapExercisesToRows(template.exerciseEntries));
    setEditingWorkoutId(null);
    setError(null);
  }

  function applyFromLoggedWorkout(entry: WorkoutLog) {
    setWorkoutType(entry.workoutType);
    setDurationText(String(entry.durationMinutes));
    setIntensityRpeText(toRpeText(entry.intensityRpe));
    setCaloriesBurnedText(entry.caloriesBurned !== undefined ? String(entry.caloriesBurned) : "");
    setTemplateNameText(entry.templateName ?? "Custom");
    setNotes(entry.notes ?? "");
    setExerciseRows(mapExercisesToRows(entry.exerciseEntries ?? []));
    setEditingWorkoutId(null);
    setError(null);
  }

  function updateExerciseRow(rowId: string, patch: Partial<ExerciseDraftRow>) {
    setExerciseRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  }

  function addExerciseRow() {
    setExerciseRows((prev) => [...prev, createExerciseRow()]);
  }

  function removeExerciseRow(rowId: string) {
    setExerciseRows((prev) => {
      if (prev.length === 1) {
        return [createExerciseRow()];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  }

  function buildDraft(requireAtLeastOneExercise: boolean): { draft: WorkoutDraft | null; message?: string } {
    const durationMinutes = Number(durationText);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 300) {
      return { draft: null, message: "Duration must be between 5 and 300 minutes." };
    }

    const trimmedName = templateNameText.trim();
    const trimmedNotes = notes.trim();
    const parsedExercises: WorkoutExerciseEntry[] = [];

    for (const row of exerciseRows) {
      const name = row.name.trim();
      const setsRaw = row.setsText.trim();
      const repsRaw = row.repsText.trim();
      const weightRaw = row.weightText.trim();
      const hasAnyInput = Boolean(name || setsRaw || repsRaw || weightRaw);

      if (!hasAnyInput) {
        continue;
      }

      const sets = Number(setsRaw);
      const reps = Number(repsRaw);
      const weight = Number(weightRaw);

      if (!name) {
        return { draft: null, message: "Exercise name is required for each filled row." };
      }
      if (!Number.isFinite(sets) || sets < 1 || sets > 30) {
        return { draft: null, message: `Sets for "${name}" must be between 1 and 30.` };
      }
      if (!Number.isFinite(reps) || reps < 1 || reps > 200) {
        return { draft: null, message: `Reps for "${name}" must be between 1 and 200.` };
      }
      if (weightRaw && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) {
        return { draft: null, message: `Weight for "${name}" must be between 0 and 1000 kg.` };
      }

      parsedExercises.push({
        id: row.id,
        name,
        sets: Math.round(sets),
        reps: Math.round(reps),
        weightKg: weightRaw ? Number(weight.toFixed(1)) : undefined
      });
    }

    if (requireAtLeastOneExercise && parsedExercises.length === 0) {
      return { draft: null, message: "Add at least one exercise to create a reusable template." };
    }

    const intensityRaw = intensityRpeText.trim();
    const caloriesRaw = caloriesBurnedText.trim();
    const intensityRpe = intensityRaw ? Number(intensityRaw) : undefined;
    const caloriesBurned = caloriesRaw ? Number(caloriesRaw) : undefined;

    if (
      intensityRpe !== undefined &&
      (!Number.isFinite(intensityRpe) || intensityRpe < 1 || intensityRpe > 10)
    ) {
      return { draft: null, message: "RPE must be between 1 and 10." };
    }

    if (
      caloriesBurned !== undefined &&
      (!Number.isFinite(caloriesBurned) || caloriesBurned < 0 || caloriesBurned > 5000)
    ) {
      return { draft: null, message: "Calories burned must be between 0 and 5000." };
    }

    return {
      draft: {
        workoutType,
        durationMinutes: Math.round(durationMinutes),
        exerciseEntries: parsedExercises,
        intensityRpe: intensityRpe === undefined ? undefined : Number(intensityRpe.toFixed(1)),
        caloriesBurned: caloriesBurned === undefined ? undefined : Math.round(caloriesBurned),
        templateName: trimmedName ? trimmedName : undefined,
        notes: trimmedNotes ? trimmedNotes : undefined
      }
    };
  }

  function saveAsTemplate() {
    const templateName = templateNameText.trim();
    if (!templateName) {
      setError("Enter a template name first.");
      return;
    }

    const built = buildDraft(true);
    if (!built.draft) {
      setError(built.message ?? "Could not build template.");
      return;
    }

    const nextTemplate: WorkoutTemplate = {
      id: createId("tmpl"),
      name: templateName,
      workoutType: built.draft.workoutType,
      durationMinutes: built.draft.durationMinutes,
      exerciseEntries: built.draft.exerciseEntries,
      intensityRpe: built.draft.intensityRpe,
      caloriesBurned: built.draft.caloriesBurned,
      notes: built.draft.notes
    };

    setCustomTemplates((prev) => {
      const existing = prev.findIndex((item) => item.name.toLowerCase() === templateName.toLowerCase());
      if (existing === -1) {
        return [nextTemplate, ...prev];
      }
      return prev.map((item, index) => (index === existing ? { ...nextTemplate, id: item.id } : item));
    });

    setError(null);
  }

  function deleteTemplate(templateId: string) {
    setCustomTemplates((prev) => prev.filter((item) => item.id !== templateId));
  }

  async function submit() {
    const built = buildDraft(false);
    if (!built.draft) {
      setError(built.message ?? "Could not build workout.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingWorkoutId) {
        await onUpdateWorkout(editingWorkoutId, built.draft);
      } else {
        await onCreateWorkout(built.draft);
      }
      resetForm();
    } catch (_error) {
      setError(editingWorkoutId ? "Could not update workout right now." : "Could not log workout right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Log Workout</Text>
      <Text style={styles.subTitle}>Track exercises, intensity, calories, and reusable templates.</Text>

      <View style={styles.guidanceCard}>
        <Text style={styles.sectionSubTitle}>Science-Based Guidance</Text>
        <Text style={styles.guidanceMeta}>
          Target effort: RPE {scienceGuidance.targetRpe.min}-{scienceGuidance.targetRpe.max} | target duration:{" "}
          {scienceGuidance.targetDuration.min}-{scienceGuidance.targetDuration.max} min
        </Text>
        <Text style={styles.guidanceText}>{scienceGuidance.sessionMessage}</Text>

        {scienceGuidance.warnings.map((line, index) => (
          <Text key={`warning-${index}`} style={styles.guidanceWarning}>
            {line}
          </Text>
        ))}

        {scienceGuidance.progressionHints.map((line, index) => (
          <View key={`hint-${index}`} style={styles.guidanceRow}>
            <Text style={styles.guidanceBullet}>{index + 1}.</Text>
            <Text style={styles.guidanceHint}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.templatesCard}>
        <Text style={styles.sectionSubTitle}>Templates</Text>
        {templates.length === 0 ? <Text style={styles.emptyText}>No templates saved yet.</Text> : null}
        {templates.map((template) => (
          <View key={template.id} style={styles.templateRow}>
            <View style={styles.templateMain}>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateMeta}>
                {WORKOUT_TYPE_LABELS[template.workoutType]} • {template.durationMinutes} min •{" "}
                {template.exerciseEntries.length} exercises
              </Text>
            </View>
            <View style={styles.templateActions}>
              <Pressable style={styles.editButton} onPress={() => applyTemplate(template)}>
                <Text style={styles.editText}>Apply</Text>
              </Pressable>
              {template.id.startsWith("tmpl_builtin_") ? null : (
                <Pressable style={styles.deleteButton} onPress={() => deleteTemplate(template.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        {editingWorkoutId ? <Text style={styles.editingLabel}>Editing selected workout</Text> : null}

        <Text style={styles.fieldLabel}>Workout type</Text>
        <View style={styles.pills}>
          {(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[]).map((type) => {
            const active = workoutType === type;
            return (
              <Pressable
                key={type}
                style={[styles.pill, active ? styles.pillActive : undefined]}
                onPress={() => setWorkoutType(type)}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : undefined]}>
                  {WORKOUT_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Duration (minutes)</Text>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          style={styles.input}
          keyboardType="numeric"
          placeholder="45"
        />

        <View style={styles.dualFieldRow}>
          <View style={styles.dualField}>
            <Text style={styles.fieldLabel}>Intensity (RPE 1-10)</Text>
            <TextInput
              value={intensityRpeText}
              onChangeText={setIntensityRpeText}
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="8"
            />
          </View>
          <View style={styles.dualField}>
            <Text style={styles.fieldLabel}>Calories Burned</Text>
            <TextInput
              value={caloriesBurnedText}
              onChangeText={setCaloriesBurnedText}
              style={styles.input}
              keyboardType="numeric"
              placeholder="350"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Template name (optional)</Text>
        <TextInput
          value={templateNameText}
          onChangeText={setTemplateNameText}
          style={styles.input}
          placeholder="Push A"
        />

        <Text style={styles.fieldLabel}>Exercises</Text>
        {exerciseRows.map((row, index) => (
          <View key={row.id} style={styles.exerciseCard}>
            <Text style={styles.exerciseLabel}>Exercise {index + 1}</Text>
            <TextInput
              value={row.name}
              onChangeText={(value) => updateExerciseRow(row.id, { name: value })}
              style={styles.input}
              placeholder="Barbell Bench Press"
            />
            <View style={styles.exerciseValueRow}>
              <TextInput
                value={row.setsText}
                onChangeText={(value) => updateExerciseRow(row.id, { setsText: value })}
                style={[styles.input, styles.exerciseValueInput]}
                keyboardType="numeric"
                placeholder="Sets"
              />
              <TextInput
                value={row.repsText}
                onChangeText={(value) => updateExerciseRow(row.id, { repsText: value })}
                style={[styles.input, styles.exerciseValueInput]}
                keyboardType="numeric"
                placeholder="Reps"
              />
              <TextInput
                value={row.weightText}
                onChangeText={(value) => updateExerciseRow(row.id, { weightText: value })}
                style={[styles.input, styles.exerciseValueInput]}
                keyboardType="decimal-pad"
                placeholder="Weight"
              />
            </View>
            <Pressable style={styles.smallSecondaryButton} onPress={() => removeExerciseRow(row.id)}>
              <Text style={styles.smallSecondaryButtonText}>Remove Exercise</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.secondaryButton} onPress={addExerciseRow}>
          <Text style={styles.secondaryButtonText}>Add Exercise</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notesInput]}
          placeholder="How did the session feel?"
          multiline
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.secondaryButton} onPress={saveAsTemplate} disabled={isSubmitting}>
          <Text style={styles.secondaryButtonText}>Save As Template</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? "Saving..." : editingWorkoutId ? "Update Workout" : "Save Workout"}
          </Text>
        </Pressable>

        {editingWorkoutId ? (
          <Pressable style={styles.secondaryButton} onPress={resetForm} disabled={isSubmitting}>
            <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionSubTitle}>Recent Sessions</Text>
        {recentWorkouts.length === 0 ? (
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
        ) : (
          recentWorkouts.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryMain}>
                <Text style={styles.entryType}>{WORKOUT_TYPE_LABELS[entry.workoutType]}</Text>
                <Text style={styles.entryMeta}>
                  {formatDateLabel(entry.date)} • {entry.durationMinutes} min
                </Text>
                <Text style={styles.entryMeta}>
                  {entry.exerciseEntries?.length ?? 0} exercises
                  {entry.intensityRpe !== undefined ? ` • RPE ${entry.intensityRpe}` : ""}
                  {entry.caloriesBurned !== undefined ? ` • ${entry.caloriesBurned} kcal` : ""}
                </Text>
                {entry.templateName ? <Text style={styles.entryTemplate}>Template: {entry.templateName}</Text> : null}
              </View>

              <View style={styles.entryRight}>
                <Text style={entry.syncedAt ? styles.synced : styles.unsynced}>
                  {entry.syncedAt ? "Synced" : "Pending sync"}
                </Text>
                <Pressable style={styles.editButton} onPress={() => applyFromLoggedWorkout(entry)}>
                  <Text style={styles.editText}>Reuse</Text>
                </Pressable>
                <Pressable style={styles.editButton} onPress={() => startEdit(entry)}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => onDeleteWorkout(entry.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 8
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.inkStrong
  },
  subTitle: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    marginBottom: spacing.md
  },
  guidanceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  guidanceMeta: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: 12
  },
  guidanceText: {
    marginTop: spacing.sm,
    color: colors.inkSoft
  },
  guidanceWarning: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontWeight: "600"
  },
  guidanceRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  guidanceBullet: {
    width: 20,
    color: colors.accent,
    fontWeight: "800"
  },
  guidanceHint: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 12
  },
  templatesCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  sectionSubTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.inkStrong
  },
  templateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingVertical: spacing.sm
  },
  templateMain: {
    flex: 1,
    paddingRight: spacing.sm
  },
  templateName: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  templateMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2
  },
  templateActions: {
    alignItems: "flex-end"
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md
  },
  fieldLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.inkSoft,
    fontWeight: "700"
  },
  pills: {
    flexDirection: "row",
    gap: spacing.sm
  },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center"
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent
  },
  pillText: {
    color: colors.inkMuted,
    fontWeight: "600"
  },
  pillTextActive: {
    color: colors.accent,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "#f8fbf6",
    color: colors.inkStrong
  },
  dualFieldRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  dualField: {
    flex: 1
  },
  exerciseCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: "#fcfffb"
  },
  exerciseLabel: {
    color: colors.inkSoft,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  exerciseValueRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm
  },
  exerciseValueInput: {
    flex: 1
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: "top"
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontWeight: "600"
  },
  editingLabel: {
    marginBottom: spacing.sm,
    color: colors.accent,
    fontWeight: "700"
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15
  },
  secondaryButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  secondaryButtonText: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  smallSecondaryButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    alignItems: "center",
    paddingVertical: 6
  },
  smallSecondaryButtonText: {
    color: colors.inkSoft,
    fontWeight: "700",
    fontSize: 12
  },
  historyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md
  },
  emptyText: {
    color: colors.inkMuted,
    marginTop: spacing.sm
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingVertical: spacing.sm
  },
  entryMain: {
    flex: 1,
    paddingRight: spacing.sm
  },
  entryType: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  entryMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2
  },
  entryTemplate: {
    marginTop: 2,
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700"
  },
  entryRight: {
    alignItems: "flex-end"
  },
  synced: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 2
  },
  unsynced: {
    color: colors.warning,
    fontSize: 11,
    marginTop: 2
  },
  deleteButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  editButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  editText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700"
  },
  deleteText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "700"
  }
});
