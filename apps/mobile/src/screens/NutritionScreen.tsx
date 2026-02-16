import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, spacing } from "../theme";
import { NutritionLog, UserProfile } from "../types";

interface NutritionScreenProps {
  profile: UserProfile;
  nutritionLog: NutritionLog;
  onSaveNutrition: (log: NutritionLog) => void;
}

export function NutritionScreen({ profile, nutritionLog, onSaveNutrition }: NutritionScreenProps) {
  const [caloriesText, setCaloriesText] = useState(String(nutritionLog.calories));
  const [proteinText, setProteinText] = useState(String(nutritionLog.protein));
  const [carbsText, setCarbsText] = useState(String(nutritionLog.carbs));
  const [fatText, setFatText] = useState(String(nutritionLog.fat));
  const [waterText, setWaterText] = useState(String(nutritionLog.waterLiters));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaloriesText(String(nutritionLog.calories));
    setProteinText(String(nutritionLog.protein));
    setCarbsText(String(nutritionLog.carbs));
    setFatText(String(nutritionLog.fat));
    setWaterText(String(nutritionLog.waterLiters));
  }, [nutritionLog]);

  const proteinProgress = useMemo(() => {
    if (profile.proteinTargetGrams <= 0) {
      return 0;
    }
    return Math.min((nutritionLog.protein / profile.proteinTargetGrams) * 100, 100);
  }, [nutritionLog.protein, profile.proteinTargetGrams]);

  function submit() {
    const calories = Number(caloriesText);
    const protein = Number(proteinText);
    const carbs = Number(carbsText);
    const fat = Number(fatText);
    const waterLiters = Number(waterText);

    const values = [calories, protein, carbs, fat, waterLiters];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Values must be valid positive numbers.");
      return;
    }

    setError(null);
    onSaveNutrition({
      date: nutritionLog.date,
      calories,
      protein,
      carbs,
      fat,
      waterLiters
    });
  }

  function addQuickCalories(amount: number) {
    setCaloriesText(String(Math.max(0, Number(caloriesText || "0") + amount)));
  }

  function addQuickWater(amount: number) {
    const next = Math.max(0, Number(waterText || "0") + amount);
    setWaterText(next.toFixed(1));
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Nutrition</Text>
      <Text style={styles.subtitle}>Track intake and keep targets in range.</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Targets</Text>
        <Text style={styles.summaryRow}>Calories: {profile.dailyCalorieTarget} kcal</Text>
        <Text style={styles.summaryRow}>Protein: {profile.proteinTargetGrams} g</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Calories</Text>
        <TextInput
          value={caloriesText}
          onChangeText={setCaloriesText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />
        <View style={styles.quickRow}>
          <Pressable style={styles.quickBtn} onPress={() => addQuickCalories(250)}>
            <Text style={styles.quickBtnText}>+250</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => addQuickCalories(500)}>
            <Text style={styles.quickBtnText}>+500</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Protein (g)</Text>
        <TextInput
          value={proteinText}
          onChangeText={setProteinText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />

        <Text style={styles.fieldLabel}>Carbs (g)</Text>
        <TextInput
          value={carbsText}
          onChangeText={setCarbsText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />

        <Text style={styles.fieldLabel}>Fat (g)</Text>
        <TextInput
          value={fatText}
          onChangeText={setFatText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />

        <Text style={styles.fieldLabel}>Water (L)</Text>
        <TextInput
          value={waterText}
          onChangeText={setWaterText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />
        <View style={styles.quickRow}>
          <Pressable style={styles.quickBtn} onPress={() => addQuickWater(0.25)}>
            <Text style={styles.quickBtnText}>+0.25L</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => addQuickWater(0.5)}>
            <Text style={styles.quickBtnText}>+0.5L</Text>
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Protein progress</Text>
          <Text style={styles.progressValue}>{Math.round(proteinProgress)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${proteinProgress}%` }]} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>Save Today&apos;s Nutrition</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 8
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
  summaryCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#c6e7d0",
    padding: spacing.md,
    marginBottom: spacing.md
  },
  summaryTitle: {
    fontWeight: "800",
    color: colors.inkStrong,
    marginBottom: spacing.sm
  },
  summaryRow: {
    color: colors.inkSoft,
    fontWeight: "600"
  },
  formCard: {
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
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "#f8fbf6",
    color: colors.inkStrong
  },
  quickRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  quickBtnText: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  progressRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressLabel: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  progressValue: {
    color: colors.accent,
    fontWeight: "800"
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e6ede5",
    marginTop: spacing.xs,
    overflow: "hidden"
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.accent
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
  }
});

