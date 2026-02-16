import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GOAL_DESCRIPTIONS, GOAL_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { FitnessGoal, UserProfile } from "../types";
import { calculateTargets } from "../utils/targets";

interface OnboardingScreenProps {
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [name, setName] = useState("");
  const [ageText, setAgeText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [goal, setGoal] = useState<FitnessGoal>("maintain");
  const [error, setError] = useState<string | null>(null);

  const note = useMemo(() => GOAL_DESCRIPTIONS[goal], [goal]);

  function submit() {
    const age = Number(ageText);
    const heightCm = Number(heightText);
    const weightKg = Number(weightText);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (!Number.isFinite(age) || age < 12 || age > 90) {
      setError("Enter a valid age between 12 and 90.");
      return;
    }

    if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) {
      setError("Enter height in cm between 120 and 230.");
      return;
    }

    if (!Number.isFinite(weightKg) || weightKg < 35 || weightKg > 220) {
      setError("Enter weight in kg between 35 and 220.");
      return;
    }

    setError(null);

    const { dailyCalorieTarget, proteinTargetGrams } = calculateTargets(goal, weightKg);

    onComplete({
      id: "local-user",
      name: name.trim(),
      age,
      heightCm,
      currentWeightKg: weightKg,
      goal,
      dailyCalorieTarget,
      proteinTargetGrams
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.brand}>FitTrack</Text>
        <Text style={styles.title}>Build your custom plan</Text>
        <Text style={styles.subtitle}>
          Add your profile once. The app will generate calorie and workout targets automatically.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          style={styles.input}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput
          value={ageText}
          onChangeText={setAgeText}
          placeholder="24"
          style={styles.input}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Height (cm)</Text>
        <TextInput
          value={heightText}
          onChangeText={setHeightText}
          placeholder="175"
          style={styles.input}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Weight (kg)</Text>
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          placeholder="72"
          style={styles.input}
          keyboardType="numeric"
        />

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

        <Text style={styles.goalNote}>{note}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>Create My Plan</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8
  },
  hero: {
    marginBottom: spacing.lg
  },
  brand: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.inkStrong
  },
  title: {
    fontSize: 24,
    marginTop: spacing.xs,
    fontWeight: "800",
    color: colors.inkStrong
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.xl,
    padding: spacing.lg
  },
  fieldLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontWeight: "700",
    color: colors.inkSoft
  },
  input: {
    backgroundColor: "#f8fbf6",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.inkStrong
  },
  goalGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  goalButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md
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
    color: colors.accent
  },
  goalNote: {
    marginTop: spacing.sm,
    color: colors.inkMuted,
    fontSize: 12
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontWeight: "600"
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    alignItems: "center",
    paddingVertical: spacing.md
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  }
});
