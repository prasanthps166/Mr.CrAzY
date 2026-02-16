import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { fetchSamplePlan, syncWorkoutLog } from "./src/api/fitnessApi";
import { TabBar } from "./src/components/TabBar";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { NutritionScreen } from "./src/screens/NutritionScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { colors, spacing } from "./src/theme";
import { emptyAppData, loadAppData, saveAppData } from "./src/storage/appStore";
import { AppData, AppTab, NutritionLog, ProgressDraft, SamplePlan, UserProfile, WorkoutDraft } from "./src/types";
import { formatDateLabel, toDateKey } from "./src/utils/date";

function makeNutritionLog(date: string): NutritionLog {
  return {
    date,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    waterLiters: 0
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [appData, setAppData] = useState<AppData>(emptyAppData);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [samplePlan, setSamplePlan] = useState<SamplePlan | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadAppData().then((loaded) => {
      if (mounted) {
        setAppData(loaded);
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    saveAppData(appData).catch(() => {
      // Non-blocking save.
    });
  }, [appData, isReady]);

  const goal = appData.profile?.goal;

  useEffect(() => {
    if (!goal) {
      setSamplePlan(null);
      return;
    }

    let mounted = true;

    fetchSamplePlan().then((plan) => {
      if (mounted) {
        setSamplePlan(plan);
      }
    });

    return () => {
      mounted = false;
    };
  }, [goal]);

  const today = toDateKey();
  const nutritionLog = useMemo(
    () => appData.nutritionByDate[today] ?? makeNutritionLog(today),
    [appData.nutritionByDate, today]
  );
  const unsyncedCount = appData.workouts.filter((entry) => !entry.syncedAt).length;

  function completeOnboarding(profile: UserProfile) {
    setAppData((prev) => ({
      ...prev,
      profile
    }));
  }

  function markWorkoutSynced(workoutId: string) {
    setAppData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((entry) =>
        entry.id === workoutId
          ? { ...entry, syncedAt: new Date().toISOString() }
          : entry
      )
    }));
  }

  async function handleCreateWorkout(draft: WorkoutDraft) {
    const workout = {
      id: createId("wk"),
      date: today,
      workoutType: draft.workoutType,
      durationMinutes: draft.durationMinutes,
      notes: draft.notes,
      createdAt: new Date().toISOString(),
      syncedAt: null
    };

    setAppData((prev) => ({
      ...prev,
      workouts: [workout, ...prev.workouts]
    }));

    const synced = await syncWorkoutLog(workout);
    if (synced) {
      markWorkoutSynced(workout.id);
    }
  }

  async function retryUnsyncedWorkouts() {
    const pending = appData.workouts.filter((entry) => !entry.syncedAt);
    if (pending.length === 0 || syncing) {
      return;
    }

    setSyncing(true);
    try {
      for (const workout of pending) {
        const synced = await syncWorkoutLog(workout);
        if (synced) {
          markWorkoutSynced(workout.id);
        }
      }
    } finally {
      setSyncing(false);
    }
  }

  function handleSaveNutrition(nextLog: NutritionLog) {
    setAppData((prev) => ({
      ...prev,
      nutritionByDate: {
        ...prev.nutritionByDate,
        [nextLog.date]: nextLog
      }
    }));
  }

  function handleAddProgress(draft: ProgressDraft) {
    const entry = {
      id: createId("prog"),
      date: today,
      weightKg: draft.weightKg,
      bodyFatPct: draft.bodyFatPct,
      waistCm: draft.waistCm
    };

    setAppData((prev) => ({
      ...prev,
      profile: prev.profile
        ? { ...prev.profile, currentWeightKg: draft.weightKg }
        : prev.profile,
      progressEntries: [entry, ...prev.progressEntries]
    }));
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading FitTrack...</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.orbTopLeft} />
      <View style={styles.orbBottomRight} />

      {!appData.profile ? (
        <OnboardingScreen onComplete={completeOnboarding} />
      ) : (
        <View style={styles.appContent}>
          <View style={styles.header}>
            <Text style={styles.headerBrand}>FitTrack</Text>
            <Text style={styles.headerDate}>{formatDateLabel(today)}</Text>
          </View>

          <View style={styles.screenWrap}>
            {activeTab === "dashboard" ? (
              <DashboardScreen
                profile={appData.profile}
                workouts={appData.workouts}
                nutritionLog={nutritionLog}
                progressEntries={appData.progressEntries}
                samplePlan={samplePlan}
                unsyncedCount={unsyncedCount}
                syncing={syncing}
                onRetrySync={retryUnsyncedWorkouts}
              />
            ) : null}

            {activeTab === "workout" ? (
              <WorkoutScreen workouts={appData.workouts} onCreateWorkout={handleCreateWorkout} />
            ) : null}

            {activeTab === "nutrition" ? (
              <NutritionScreen
                profile={appData.profile}
                nutritionLog={nutritionLog}
                onSaveNutrition={handleSaveNutrition}
              />
            ) : null}

            {activeTab === "progress" ? (
              <ProgressScreen
                profile={appData.profile}
                entries={appData.progressEntries}
                onAddProgress={handleAddProgress}
              />
            ) : null}
          </View>

          <TabBar activeTab={activeTab} onChangeTab={setActiveTab} />
        </View>
      )}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.pageBg
  },
  appContent: {
    flex: 1
  },
  header: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm
  },
  headerBrand: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.inkStrong
  },
  headerDate: {
    marginTop: 2,
    color: colors.inkMuted,
    fontWeight: "600"
  },
  screenWrap: {
    flex: 1
  },
  orbTopLeft: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#dff1e5",
    top: -80,
    left: -40
  },
  orbBottomRight: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#d3e7ff",
    bottom: -110,
    right: -100
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm
  },
  loadingText: {
    color: colors.inkMuted,
    fontWeight: "600"
  }
});
