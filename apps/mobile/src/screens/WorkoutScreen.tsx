import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { WORKOUT_TYPE_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { WorkoutDraft, WorkoutLog, WorkoutType } from "../types";
import { formatDateLabel } from "../utils/date";

interface WorkoutScreenProps {
  workouts: WorkoutLog[];
  onCreateWorkout: (draft: WorkoutDraft) => Promise<void>;
}

export function WorkoutScreen({ workouts, onCreateWorkout }: WorkoutScreenProps) {
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [durationText, setDurationText] = useState("45");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recentWorkouts = useMemo(() => workouts.slice(0, 8), [workouts]);

  async function submit() {
    const durationMinutes = Number(durationText);

    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 300) {
      setError("Duration must be between 5 and 300 minutes.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateWorkout({
        workoutType,
        durationMinutes,
        notes: notes.trim() ? notes.trim() : undefined
      });
      setNotes("");
      setDurationText("45");
    } catch (_error) {
      setError("Could not log workout right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Log Workout</Text>
      <Text style={styles.subTitle}>Add every training session to keep streak and progress accurate.</Text>

      <View style={styles.card}>
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

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notesInput]}
          placeholder="How did the session feel?"
          multiline
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "Saving..." : "Save Workout"}</Text>
        </Pressable>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionSubTitle}>Recent Sessions</Text>
        {recentWorkouts.length === 0 ? (
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
        ) : (
          recentWorkouts.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View>
                <Text style={styles.entryType}>{WORKOUT_TYPE_LABELS[entry.workoutType]}</Text>
                <Text style={styles.entryMeta}>{formatDateLabel(entry.date)}</Text>
              </View>
              <View style={styles.entryRight}>
                <Text style={styles.entryDuration}>{entry.durationMinutes} min</Text>
                <Text style={entry.syncedAt ? styles.synced : styles.unsynced}>
                  {entry.syncedAt ? "Synced" : "Pending sync"}
                </Text>
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
  notesInput: {
    minHeight: 82,
    textAlignVertical: "top"
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontWeight: "600"
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
  historyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md
  },
  sectionSubTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.inkStrong
  },
  emptyText: {
    color: colors.inkMuted,
    marginTop: spacing.sm
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingVertical: spacing.sm
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
  entryRight: {
    alignItems: "flex-end"
  },
  entryDuration: {
    color: colors.inkStrong,
    fontWeight: "800"
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
  }
});

