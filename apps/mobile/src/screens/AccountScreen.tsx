import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { GOAL_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { AppSettings, FitnessGoal, UserProfile } from "../types";
import { formatDateLabel } from "../utils/date";
import { calculateTargets } from "../utils/targets";

interface AccountScreenProps {
  profile: UserProfile;
  pendingSummary: {
    total: number;
    workouts: number;
    nutrition: number;
    progress: number;
    profile: boolean;
    lastSuccessfulSyncAt: string | null;
  };
  syncing: boolean;
  reminderSettings: Pick<AppSettings, "dailyReminderEnabled" | "dailyReminderTime">;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSaveReminderSettings: (settings: { enabled: boolean; time: string }) => Promise<void>;
  onSyncNow: () => void;
  onResetAllData: () => void;
}

function toDateLabel(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  return formatDateLabel(iso.slice(0, 10));
}

export function AccountScreen({
  profile,
  pendingSummary,
  syncing,
  reminderSettings,
  onSaveProfile,
  onSaveReminderSettings,
  onSyncNow,
  onResetAllData
}: AccountScreenProps) {
  const [name, setName] = useState(profile.name);
  const [ageText, setAgeText] = useState(String(profile.age));
  const [heightText, setHeightText] = useState(String(profile.heightCm));
  const [weightText, setWeightText] = useState(String(profile.currentWeightKg));
  const [dailyCaloriesText, setDailyCaloriesText] = useState(String(profile.dailyCalorieTarget));
  const [proteinText, setProteinText] = useState(String(profile.proteinTargetGrams));
  const [goal, setGoal] = useState<FitnessGoal>(profile.goal);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(reminderSettings.dailyReminderEnabled);
  const [reminderTimeText, setReminderTimeText] = useState(reminderSettings.dailyReminderTime);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setAgeText(String(profile.age));
    setHeightText(String(profile.heightCm));
    setWeightText(String(profile.currentWeightKg));
    setDailyCaloriesText(String(profile.dailyCalorieTarget));
    setProteinText(String(profile.proteinTargetGrams));
    setGoal(profile.goal);
  }, [profile]);

  useEffect(() => {
    setReminderEnabled(reminderSettings.dailyReminderEnabled);
    setReminderTimeText(reminderSettings.dailyReminderTime);
  }, [reminderSettings]);

  function autoCalculateTargets() {
    const weightKg = Number(weightText);
    if (!Number.isFinite(weightKg) || weightKg < 35 || weightKg > 220) {
      setError("Enter a valid weight first to auto-calculate targets.");
      return;
    }
    const targets = calculateTargets(goal, weightKg);
    setDailyCaloriesText(String(targets.dailyCalorieTarget));
    setProteinText(String(targets.proteinTargetGrams));
    setError(null);
  }

  async function save() {
    const age = Number(ageText);
    const heightCm = Number(heightText);
    const weightKg = Number(weightText);
    const dailyCalorieTarget = Number(dailyCaloriesText);
    const proteinTargetGrams = Number(proteinText);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(age) || age < 12 || age > 90) {
      setError("Age must be between 12 and 90.");
      return;
    }
    if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) {
      setError("Height must be between 120 and 230 cm.");
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 35 || weightKg > 220) {
      setError("Weight must be between 35 and 220 kg.");
      return;
    }
    if (!Number.isFinite(dailyCalorieTarget) || dailyCalorieTarget < 1000 || dailyCalorieTarget > 6000) {
      setError("Calories must be between 1000 and 6000.");
      return;
    }
    if (!Number.isFinite(proteinTargetGrams) || proteinTargetGrams < 40 || proteinTargetGrams > 300) {
      setError("Protein target must be between 40g and 300g.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSaveProfile({
        ...profile,
        name: name.trim(),
        age,
        heightCm,
        currentWeightKg: weightKg,
        goal,
        dailyCalorieTarget,
        proteinTargetGrams
      });
    } catch (_error) {
      setError("Could not save profile right now.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReminderSettings() {
    setSavingReminder(true);
    setReminderError(null);

    try {
      await onSaveReminderSettings({
        enabled: reminderEnabled,
        time: reminderTimeText.trim()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save reminder settings.";
      setReminderError(message);
    } finally {
      setSavingReminder(false);
    }
  }

  function requestReset() {
    Alert.alert(
      "Reset all data",
      "This clears local and server fitness data for this app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: onResetAllData
        }
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>Update profile, targets, and sync state.</Text>

      <View style={styles.syncCard}>
        <Text style={styles.syncTitle}>Sync Status</Text>
        <Text style={styles.syncLine}>Pending changes: {pendingSummary.total}</Text>
        <Text style={styles.syncLine}>Workouts: {pendingSummary.workouts}</Text>
        <Text style={styles.syncLine}>Nutrition: {pendingSummary.nutrition}</Text>
        <Text style={styles.syncLine}>Progress: {pendingSummary.progress}</Text>
        <Text style={styles.syncLine}>Profile: {pendingSummary.profile ? "Pending" : "Synced"}</Text>
        <Text style={styles.syncLine}>Last success: {toDateLabel(pendingSummary.lastSuccessfulSyncAt)}</Text>
        <Pressable style={styles.syncButton} onPress={onSyncNow} disabled={syncing}>
          <Text style={styles.syncButtonText}>{syncing ? "Syncing..." : "Sync Now"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} autoCapitalize="words" />

        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput value={ageText} onChangeText={setAgeText} style={styles.input} keyboardType="numeric" />

        <Text style={styles.fieldLabel}>Height (cm)</Text>
        <TextInput value={heightText} onChangeText={setHeightText} style={styles.input} keyboardType="numeric" />

        <Text style={styles.fieldLabel}>Weight (kg)</Text>
        <TextInput value={weightText} onChangeText={setWeightText} style={styles.input} keyboardType="numeric" />

        <Text style={styles.fieldLabel}>Goal</Text>
        <View style={styles.goalGroup}>
          {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((goalKey) => {
            const active = goal === goalKey;
            return (
              <Pressable
                key={goalKey}
                style={[styles.goalButton, active ? styles.goalButtonActive : undefined]}
                onPress={() => setGoal(goalKey)}
              >
                <Text style={[styles.goalButtonText, active ? styles.goalButtonTextActive : undefined]}>
                  {GOAL_LABELS[goalKey]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Daily Calories</Text>
        <TextInput
          value={dailyCaloriesText}
          onChangeText={setDailyCaloriesText}
          style={styles.input}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Protein Target (g)</Text>
        <TextInput value={proteinText} onChangeText={setProteinText} style={styles.input} keyboardType="numeric" />

        <Pressable style={styles.secondaryButton} onPress={autoCalculateTargets}>
          <Text style={styles.secondaryButtonText}>Auto-calculate targets</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save Profile"}</Text>
        </Pressable>
      </View>

      <View style={styles.reminderCard}>
        <Text style={styles.reminderTitle}>Daily Reminder</Text>
        <Text style={styles.reminderSubtitle}>Schedule a notification to log your workout every day.</Text>

        <View style={styles.reminderToggleRow}>
          <Text style={styles.reminderLabel}>Enable reminder</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: "#cbd8cc", true: "#9fd8b5" }}
            thumbColor={reminderEnabled ? colors.accent : "#f6f6f6"}
          />
        </View>

        <Text style={styles.fieldLabel}>Reminder Time (24h HH:MM)</Text>
        <TextInput
          value={reminderTimeText}
          onChangeText={setReminderTimeText}
          style={styles.input}
          placeholder="20:00"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {reminderError ? <Text style={styles.errorText}>{reminderError}</Text> : null}

        <Pressable style={styles.secondaryButton} onPress={saveReminderSettings} disabled={savingReminder}>
          <Text style={styles.secondaryButtonText}>{savingReminder ? "Saving..." : "Save Reminder"}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.resetButton} onPress={requestReset}>
        <Text style={styles.resetText}>Reset All Data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 8
  },
  reminderCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  reminderTitle: {
    color: colors.inkStrong,
    fontWeight: "800",
    fontSize: 18
  },
  reminderSubtitle: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    marginBottom: spacing.sm
  },
  reminderToggleRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  reminderLabel: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.inkStrong
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.inkMuted
  },
  syncCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#f1d88f",
    padding: spacing.md,
    marginBottom: spacing.md
  },
  syncTitle: {
    color: colors.warning,
    fontWeight: "800",
    marginBottom: spacing.xs
  },
  syncLine: {
    color: colors.warning,
    marginTop: 2
  },
  syncButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.warning,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  syncButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  fieldLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.inkSoft,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    backgroundColor: "#f8fbf6",
    color: colors.inkStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  goalGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  goalButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  goalButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  goalButtonText: {
    color: colors.inkSoft,
    fontWeight: "600"
  },
  goalButtonTextActive: {
    color: colors.accent,
    fontWeight: "700"
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: "700"
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
    fontWeight: "700"
  },
  resetButton: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  resetText: {
    color: colors.danger,
    fontWeight: "700"
  }
});
