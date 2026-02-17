import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FALLBACK_PLANS, GOAL_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { NutritionLog, ProgressEntry, SamplePlan, UserProfile, WorkoutLog } from "../types";
import { getWeeklyWorkoutCount, getWorkoutStreak } from "../utils/date";
import { getScienceBasedInsight } from "../utils/scienceTraining";

interface DashboardScreenProps {
  profile: UserProfile;
  workouts: WorkoutLog[];
  nutritionLog: NutritionLog;
  progressEntries: ProgressEntry[];
  samplePlan: SamplePlan | null;
  pendingSummary: {
    total: number;
    workouts: number;
    nutrition: number;
    progress: number;
    profile: boolean;
    lastSuccessfulSyncAt: string | null;
  };
  syncing: boolean;
  onRetrySync: () => void;
}

export function DashboardScreen({
  profile,
  workouts,
  nutritionLog,
  progressEntries,
  samplePlan,
  pendingSummary,
  syncing,
  onRetrySync
}: DashboardScreenProps) {
  const streak = getWorkoutStreak(workouts);
  const weekCount = getWeeklyWorkoutCount(workouts);
  const caloriesLeft = Math.max(profile.dailyCalorieTarget - nutritionLog.calories, 0);
  const lastWeight = progressEntries[0]?.weightKg ?? profile.currentWeightKg;
  const planItems = samplePlan?.weeklyPlan.length ? samplePlan.weeklyPlan : FALLBACK_PLANS[profile.goal];
  const lastSyncLabel = pendingSummary.lastSuccessfulSyncAt
    ? pendingSummary.lastSuccessfulSyncAt.slice(0, 10)
    : "Never";
  const scienceInsight = getScienceBasedInsight(profile.goal, workouts);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.greeting}>Hi {profile.name}</Text>
      <Text style={styles.sectionSubTitle}>Goal: {GOAL_LABELS[profile.goal]}</Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Streak</Text>
          <Text style={styles.metricValue}>{streak} days</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Workouts (week)</Text>
          <Text style={styles.metricValue}>{weekCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Calories left</Text>
          <Text style={styles.metricValue}>{caloriesLeft}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Current weight</Text>
          <Text style={styles.metricValue}>{lastWeight} kg</Text>
        </View>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Weekly Plan</Text>
        {planItems.map((item) => (
          <View key={`${item.day}-${item.focus}`} style={styles.planRow}>
            <View>
              <Text style={styles.planDay}>{item.day}</Text>
              <Text style={styles.planFocus}>{item.focus}</Text>
            </View>
            <Text style={styles.planDuration}>{item.durationMinutes} min</Text>
          </View>
        ))}
      </View>

      <View style={styles.scienceCard}>
        <Text style={styles.planTitle}>Science-Based Check</Text>
        <Text style={styles.scienceFocus}>{scienceInsight.focusMessage}</Text>

        <Text style={styles.scienceLabel}>Weekly Muscle Volume</Text>
        {scienceInsight.weeklyVolume.map((item) => (
          <View key={item.group} style={styles.landmarkRow}>
            <Text style={styles.landmarkGroup}>{item.label}</Text>
            <Text style={styles.landmarkValue}>
              {item.sets} sets (target {item.target.min}-{item.target.max})
            </Text>
            <Text
              style={[
                styles.landmarkStatus,
                item.status === "low"
                  ? styles.statusLow
                  : item.status === "high"
                    ? styles.statusHigh
                    : styles.statusOnTarget
              ]}
            >
              {item.status === "low" ? "Low" : item.status === "high" ? "High" : "On target"}
            </Text>
          </View>
        ))}

        <Text style={styles.scienceLabel}>Progression Signals</Text>
        {scienceInsight.progressionTips.slice(0, 2).map((tip, index) => (
          <View key={`tip-${index}`} style={styles.tipRow}>
            <Text style={styles.tipBullet}>{index + 1}.</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}

        <Text style={styles.scienceRecovery}>{scienceInsight.recoveryMessage}</Text>
      </View>

      <View style={styles.nutritionCard}>
        <Text style={styles.planTitle}>Today&apos;s Fuel</Text>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Protein</Text>
          <Text style={styles.nutritionValue}>
            {nutritionLog.protein}g / {profile.proteinTargetGrams}g
          </Text>
        </View>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Water</Text>
          <Text style={styles.nutritionValue}>{nutritionLog.waterLiters.toFixed(1)} L</Text>
        </View>
      </View>

      {pendingSummary.total > 0 ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>
            {pendingSummary.total} pending changes.
          </Text>
          <Text style={styles.syncSubText}>
            W:{pendingSummary.workouts} N:{pendingSummary.nutrition} P:{pendingSummary.progress}{" "}
            {pendingSummary.profile ? "Profile pending" : "Profile synced"}
          </Text>
          <Pressable style={styles.syncButton} onPress={onRetrySync} disabled={syncing}>
            <Text style={styles.syncButtonText}>{syncing ? "Syncing..." : "Sync Now"}</Text>
          </Pressable>
          <Text style={styles.syncMeta}>Last successful sync: {lastSyncLabel}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 8
  },
  greeting: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.inkStrong
  },
  sectionSubTitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.inkMuted,
    fontWeight: "600"
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  metricLabel: {
    color: colors.inkMuted,
    fontSize: 12,
    marginBottom: spacing.xs
  },
  metricValue: {
    color: colors.inkStrong,
    fontSize: 19,
    fontWeight: "800"
  },
  planCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.inkStrong,
    marginBottom: spacing.sm
  },
  planRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  planDay: {
    fontWeight: "700",
    color: colors.inkSoft
  },
  planFocus: {
    color: colors.inkMuted,
    marginTop: 2,
    maxWidth: 190
  },
  planDuration: {
    color: colors.accent,
    fontWeight: "700"
  },
  scienceCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  scienceFocus: {
    color: colors.inkSoft,
    marginBottom: spacing.sm
  },
  scienceLabel: {
    color: colors.inkSoft,
    fontWeight: "800",
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  landmarkRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8"
  },
  landmarkGroup: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  landmarkValue: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2
  },
  landmarkStatus: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  statusLow: {
    color: colors.warning
  },
  statusHigh: {
    color: colors.danger
  },
  statusOnTarget: {
    color: colors.accent
  },
  tipRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  tipBullet: {
    width: 20,
    color: colors.accent,
    fontWeight: "800"
  },
  tipText: {
    flex: 1,
    color: colors.inkSoft
  },
  scienceRecovery: {
    marginTop: spacing.sm,
    color: colors.warning,
    fontWeight: "600"
  },
  nutritionCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingVertical: spacing.sm
  },
  nutritionLabel: {
    color: colors.inkMuted,
    fontWeight: "600"
  },
  nutritionValue: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  syncBanner: {
    marginTop: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md
  },
  syncText: {
    color: colors.warning,
    fontWeight: "600"
  },
  syncSubText: {
    marginTop: spacing.xs,
    color: colors.warning
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
  syncMeta: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 12
  }
});
