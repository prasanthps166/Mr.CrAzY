import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";

import {
  clearRemoteData,
  fetchMe,
  deleteNutritionLog,
  deleteProgressEntry,
  deleteWorkoutLog,
  fetchSamplePlan,
  fetchSnapshot,
  loginWithEmail,
  logoutAuth,
  registerWithEmail,
  setAuthToken,
  syncNutritionLog,
  syncProfile,
  syncProgressEntry,
  syncWorkoutLog
} from "./src/api/fitnessApi";
import { TabBar } from "./src/components/TabBar";
import { KnowledgeScreen } from "./src/screens/KnowledgeScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { NutritionScreen } from "./src/screens/NutritionScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { mergeSnapshot, updateWorkoutInList } from "./src/state/appState";
import { colors, spacing } from "./src/theme";
import { createEmptyAppData, emptyAppData, loadAppData, saveAppData } from "./src/storage/appStore";
import {
  AppData,
  AppSettings,
  AppTab,
  NutritionLog,
  ProgressDraft,
  SamplePlan,
  UserProfile,
  WorkoutDraft
} from "./src/types";
import { formatDateLabel, toDateKey } from "./src/utils/date";
import {
  cancelReminderById,
  configureReminderNotifications,
  isValidReminderTime,
  scheduleDailyReminder
} from "./src/services/reminders";

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

function withUnique<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items : [...items, value];
}

function withReminderSettings(prev: AppData, settingsPatch: Partial<AppSettings>): AppData {
  return {
    ...prev,
    settings: {
      ...prev.settings,
      ...settingsPatch
    }
  };
}

export default function App() {
  const [appData, setAppData] = useState<AppData>(emptyAppData);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [samplePlan, setSamplePlan] = useState<SamplePlan | null>(null);
  const [syncing, setSyncing] = useState(false);
  const appDataRef = useRef(appData);

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const loaded = await loadAppData();
      setAuthToken(loaded.auth.token);

      let nextData = loaded;
      if (loaded.auth.token) {
        const me = await fetchMe();
        if (me) {
          nextData = {
            ...loaded,
            auth: {
              userId: me.id,
              email: me.email,
              token: loaded.auth.token
            }
          };
        } else {
          setAuthToken(null);
          nextData = createEmptyAppData();
        }
      }

      if (mounted) {
        setAppData(nextData);
        setIsReady(true);
      }
    })();

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

  useEffect(() => {
    if (!isReady) {
      return;
    }
    configureReminderNotifications();
  }, [isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!appData.settings.dailyReminderEnabled || appData.settings.reminderNotificationId) {
      return;
    }

    const time = appData.settings.dailyReminderTime;
    if (!isValidReminderTime(time)) {
      return;
    }

    void (async () => {
      const scheduled = await scheduleDailyReminder(
        time,
        "FitTrack reminder",
        "Log your workout and keep the streak alive."
      );

      if (!scheduled.ok) {
        return;
      }

      setAppData((prev) =>
        withReminderSettings(prev, {
          reminderNotificationId: scheduled.notificationId
        })
      );
    })();
  }, [
    appData.settings.dailyReminderEnabled,
    appData.settings.dailyReminderTime,
    appData.settings.reminderNotificationId,
    isReady
  ]);

  const goal = appData.profile?.goal;

  useEffect(() => {
    if (!goal) {
      setSamplePlan(null);
      return;
    }

    let mounted = true;

    fetchSamplePlan(goal).then((plan) => {
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
  const pendingSummary = useMemo(() => {
    const workouts =
      appData.workouts.filter((entry) => !entry.syncedAt).length +
      appData.sync.deletedWorkoutIds.length;
    const nutrition =
      appData.sync.nutritionPendingDates.length +
      appData.sync.deletedNutritionDates.length;
    const progress =
      appData.sync.progressPendingIds.length +
      appData.sync.deletedProgressIds.length;
    const profile = appData.sync.profilePending;
    return {
      workouts,
      nutrition,
      progress,
      profile,
      total: workouts + nutrition + progress + (profile ? 1 : 0),
      lastSuccessfulSyncAt: appData.sync.lastSuccessfulSyncAt
    };
  }, [appData.sync, appData.workouts]);

  function setProfilePending(pending: boolean) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        profilePending: pending,
        lastSuccessfulSyncAt: pending ? prev.sync.lastSuccessfulSyncAt : nowIso
      }
    }));
  }

  function addNutritionPending(date: string) {
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        nutritionPendingDates: withUnique(prev.sync.nutritionPendingDates, date),
        deletedNutritionDates: prev.sync.deletedNutritionDates.filter((item) => item !== date)
      }
    }));
  }

  function resolveNutritionPending(date: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        nutritionPendingDates: prev.sync.nutritionPendingDates.filter((item) => item !== date),
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  function addProgressPending(id: string) {
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        progressPendingIds: withUnique(prev.sync.progressPendingIds, id),
        deletedProgressIds: prev.sync.deletedProgressIds.filter((item) => item !== id)
      }
    }));
  }

  function resolveProgressPending(id: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        progressPendingIds: prev.sync.progressPendingIds.filter((item) => item !== id),
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  function addWorkoutDeletePending(id: string) {
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        deletedWorkoutIds: withUnique(prev.sync.deletedWorkoutIds, id)
      }
    }));
  }

  function resolveWorkoutDeletePending(id: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        deletedWorkoutIds: prev.sync.deletedWorkoutIds.filter((item) => item !== id),
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  function addNutritionDeletePending(date: string) {
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        nutritionPendingDates: prev.sync.nutritionPendingDates.filter((item) => item !== date),
        deletedNutritionDates: withUnique(prev.sync.deletedNutritionDates, date)
      }
    }));
  }

  function resolveNutritionDeletePending(date: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        deletedNutritionDates: prev.sync.deletedNutritionDates.filter((item) => item !== date),
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  function addProgressDeletePending(id: string) {
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        progressPendingIds: prev.sync.progressPendingIds.filter((item) => item !== id),
        deletedProgressIds: withUnique(prev.sync.deletedProgressIds, id)
      }
    }));
  }

  function resolveProgressDeletePending(id: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        deletedProgressIds: prev.sync.deletedProgressIds.filter((item) => item !== id),
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  async function applyAuthSession(user: { id: string; email: string }, token: string | null) {
    const auth = {
      userId: user.id,
      email: user.email,
      token
    };

    setSamplePlan(null);
    setActiveTab("dashboard");
    setAuthToken(token);
    setAppData({
      ...createEmptyAppData(),
      auth
    });

    const snapshot = await fetchSnapshot();
    if (!snapshot) {
      return;
    }

    setAppData((prev) => ({
      ...mergeSnapshot(prev, snapshot),
      sync: {
        ...prev.sync,
        lastSuccessfulSyncAt: new Date().toISOString()
      }
    }));
  }

  async function handleLogin(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const result = await loginWithEmail(email, password);
    if (!result) {
      return {
        ok: false,
        message: "Invalid email or password."
      };
    }

    await applyAuthSession(
      {
        id: result.user.id,
        email: result.user.email
      },
      result.token
    );

    return { ok: true };
  }

  async function handleRegister(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const result = await registerWithEmail(email, password);
    if (!result) {
      return {
        ok: false,
        message: "Registration failed. Try a different email."
      };
    }

    await applyAuthSession(
      {
        id: result.user.id,
        email: result.user.email
      },
      result.token
    );

    return { ok: true };
  }

  function handleContinueGuest() {
    setSamplePlan(null);
    setActiveTab("dashboard");
    setAuthToken(null);
    setAppData((prev) => ({
      ...prev,
      auth: {
        userId: "local-user",
        email: null,
        token: null
      }
    }));
  }

  async function handleLogout() {
    await cancelReminderById(appDataRef.current.settings.reminderNotificationId);
    await logoutAuth();
    setAuthToken(null);
    setSamplePlan(null);
    setActiveTab("dashboard");
    setAppData(createEmptyAppData());
  }

  useEffect(() => {
    if (!isReady || !appData.auth.userId) {
      return;
    }

    let mounted = true;

    fetchSnapshot().then((snapshot) => {
      if (!mounted || !snapshot) {
        return;
      }
      setAppData((prev) => ({
        ...mergeSnapshot(prev, snapshot),
        sync: {
          ...prev.sync,
          lastSuccessfulSyncAt: new Date().toISOString()
        }
      }));
    });

    return () => {
      mounted = false;
    };
  }, [isReady, appData.auth.userId]);

  useEffect(() => {
    if (!isReady || !appData.auth.userId || pendingSummary.total === 0 || syncing) {
      return;
    }

    const timer = setTimeout(() => {
      void syncPendingChanges();
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [isReady, syncing, pendingSummary.total, appData.auth.userId]);

  async function completeOnboarding(profile: UserProfile) {
    const profileForUser = {
      ...profile,
      id: appDataRef.current.auth.userId ?? profile.id
    };

    setAppData((prev) => ({
      ...prev,
      profile: profileForUser,
      sync: {
        ...prev.sync,
        profilePending: true
      }
    }));

    const synced = await syncProfile(profileForUser);
    if (synced) {
      setProfilePending(false);
    } else {
      setProfilePending(true);
    }
  }

  function markWorkoutSynced(workoutId: string) {
    const nowIso = new Date().toISOString();
    setAppData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((entry) =>
        entry.id === workoutId
          ? { ...entry, syncedAt: nowIso }
          : entry
      ),
      sync: {
        ...prev.sync,
        lastSuccessfulSyncAt: nowIso
      }
    }));
  }

  async function handleCreateWorkout(draft: WorkoutDraft) {
    const workout = {
      id: createId("wk"),
      date: today,
      workoutType: draft.workoutType,
      durationMinutes: draft.durationMinutes,
      exerciseEntries: draft.exerciseEntries,
      intensityRpe: draft.intensityRpe,
      caloriesBurned: draft.caloriesBurned,
      templateName: draft.templateName,
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

  async function handleUpdateWorkout(workoutId: string, draft: WorkoutDraft) {
    const next = updateWorkoutInList(appDataRef.current.workouts, workoutId, draft);
    if (!next.updatedWorkout) {
      return;
    }

    setAppData((prev) => ({
      ...prev,
      workouts: next.workouts
    }));

    const synced = await syncWorkoutLog(next.updatedWorkout);
    if (synced) {
      markWorkoutSynced(workoutId);
    }
  }

  async function syncPendingChanges(options: { pullSnapshot?: boolean } = {}) {
    if (syncing) {
      return;
    }

    setSyncing(true);
    try {
      const current = appDataRef.current;

      for (const workoutId of current.sync.deletedWorkoutIds) {
        const deleted = await deleteWorkoutLog(workoutId);
        if (deleted) {
          resolveWorkoutDeletePending(workoutId);
        }
      }

      for (const date of current.sync.deletedNutritionDates) {
        const deleted = await deleteNutritionLog(date);
        if (deleted) {
          resolveNutritionDeletePending(date);
        }
      }

      for (const progressId of current.sync.deletedProgressIds) {
        const deleted = await deleteProgressEntry(progressId);
        if (deleted) {
          resolveProgressDeletePending(progressId);
        }
      }

      if (current.profile && current.sync.profilePending) {
        const syncedProfile = await syncProfile(current.profile);
        if (syncedProfile) {
          setProfilePending(false);
        }
      }

      for (const date of current.sync.nutritionPendingDates) {
        if (current.sync.deletedNutritionDates.includes(date)) {
          continue;
        }
        const log = current.nutritionByDate[date];
        if (!log) {
          resolveNutritionPending(date);
          continue;
        }
        const synced = await syncNutritionLog(log);
        if (synced) {
          resolveNutritionPending(date);
        }
      }

      for (const entryId of current.sync.progressPendingIds) {
        if (current.sync.deletedProgressIds.includes(entryId)) {
          continue;
        }
        const entry = current.progressEntries.find((item) => item.id === entryId);
        if (!entry) {
          resolveProgressPending(entryId);
          continue;
        }
        const synced = await syncProgressEntry(entry);
        if (synced) {
          resolveProgressPending(entryId);
        }
      }

      const pendingWorkouts = current.workouts.filter(
        (entry) => !entry.syncedAt && !current.sync.deletedWorkoutIds.includes(entry.id)
      );
      for (const workout of pendingWorkouts) {
        const synced = await syncWorkoutLog(workout);
        if (synced) {
          markWorkoutSynced(workout.id);
        }
      }

      if (options.pullSnapshot) {
        const snapshot = await fetchSnapshot();
        if (snapshot) {
          setAppData((prev) => ({
            ...mergeSnapshot(prev, snapshot),
            sync: {
              ...prev.sync,
              lastSuccessfulSyncAt: new Date().toISOString()
            }
          }));
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

    void (async () => {
      const synced = await syncNutritionLog(nextLog);
      if (synced) {
        resolveNutritionPending(nextLog.date);
      } else {
        addNutritionPending(nextLog.date);
      }
    })();
  }

  function handleAddProgress(draft: ProgressDraft) {
    const entry = {
      id: createId("prog"),
      date: today,
      weightKg: draft.weightKg,
      bodyFatPct: draft.bodyFatPct,
      waistCm: draft.waistCm
    };

    const nextProfile = appData.profile
      ? { ...appData.profile, currentWeightKg: draft.weightKg }
      : null;

    setAppData((prev) => ({
      ...prev,
      profile: prev.profile
        ? { ...prev.profile, currentWeightKg: draft.weightKg }
        : prev.profile,
      progressEntries: [entry, ...prev.progressEntries]
    }));

    void (async () => {
      const progressSynced = await syncProgressEntry(entry);
      if (progressSynced) {
        resolveProgressPending(entry.id);
      } else {
        addProgressPending(entry.id);
      }

      if (nextProfile) {
        const profileSynced = await syncProfile(nextProfile);
        setProfilePending(!profileSynced);
      }
    })();
  }

  function handleDeleteWorkout(workoutId: string) {
    setAppData((prev) => ({
      ...prev,
      workouts: prev.workouts.filter((entry) => entry.id !== workoutId),
      sync: {
        ...prev.sync,
        deletedWorkoutIds: withUnique(prev.sync.deletedWorkoutIds, workoutId)
      }
    }));

    void (async () => {
      const deleted = await deleteWorkoutLog(workoutId);
      if (deleted) {
        resolveWorkoutDeletePending(workoutId);
      } else {
        addWorkoutDeletePending(workoutId);
      }
    })();
  }

  function handleClearNutrition(date: string) {
    setAppData((prev) => {
      const nextNutritionByDate = { ...prev.nutritionByDate };
      delete nextNutritionByDate[date];

      return {
        ...prev,
        nutritionByDate: nextNutritionByDate,
        sync: {
          ...prev.sync,
          nutritionPendingDates: prev.sync.nutritionPendingDates.filter((item) => item !== date),
          deletedNutritionDates: withUnique(prev.sync.deletedNutritionDates, date)
        }
      };
    });

    void (async () => {
      const deleted = await deleteNutritionLog(date);
      if (deleted) {
        resolveNutritionDeletePending(date);
      } else {
        addNutritionDeletePending(date);
      }
    })();
  }

  function handleDeleteProgressEntry(entryId: string) {
    setAppData((prev) => ({
      ...prev,
      progressEntries: prev.progressEntries.filter((entry) => entry.id !== entryId),
      sync: {
        ...prev.sync,
        progressPendingIds: prev.sync.progressPendingIds.filter((item) => item !== entryId),
        deletedProgressIds: withUnique(prev.sync.deletedProgressIds, entryId)
      }
    }));

    void (async () => {
      const deleted = await deleteProgressEntry(entryId);
      if (deleted) {
        resolveProgressDeletePending(entryId);
      } else {
        addProgressDeletePending(entryId);
      }
    })();
  }

  async function handleSaveProfile(profile: UserProfile) {
    const profileForUser = {
      ...profile,
      id: appDataRef.current.auth.userId ?? profile.id
    };

    setAppData((prev) => ({
      ...prev,
      profile: profileForUser
    }));
    setProfilePending(true);
    const synced = await syncProfile(profileForUser);
    setProfilePending(!synced);
  }

  async function handleSaveReminderSettings(settings: { enabled: boolean; time: string }) {
    const nextTime = settings.time.trim();
    if (!isValidReminderTime(nextTime)) {
      throw new Error("Reminder time must be in HH:MM format.");
    }

    const previousId = appDataRef.current.settings.reminderNotificationId;
    await cancelReminderById(previousId);

    if (!settings.enabled) {
      setAppData((prev) =>
        withReminderSettings(prev, {
          dailyReminderEnabled: false,
          dailyReminderTime: nextTime,
          reminderNotificationId: null
        })
      );
      return;
    }

    const scheduled = await scheduleDailyReminder(
      nextTime,
      "FitTrack reminder",
      "Log your workout and keep the streak alive."
    );

    if (!scheduled.ok) {
      throw new Error(scheduled.reason);
    }

    setAppData((prev) =>
      withReminderSettings(prev, {
        dailyReminderEnabled: true,
        dailyReminderTime: nextTime,
        reminderNotificationId: scheduled.notificationId
      })
    );
  }

  async function handleResetAllData() {
    const activeAuth = appDataRef.current.auth;
    await cancelReminderById(appDataRef.current.settings.reminderNotificationId);

    setSyncing(true);
    try {
      await clearRemoteData();
    } finally {
      setSyncing(false);
    }

    setSamplePlan(null);
    setActiveTab("dashboard");
    setAppData({
      ...createEmptyAppData(),
      auth: activeAuth
    });
  }

  function handleSyncNow() {
    void syncPendingChanges({ pullSnapshot: true });
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

      {!appData.auth.userId ? (
        <AuthScreen
          onLogin={handleLogin}
          onRegister={handleRegister}
          onContinueGuest={handleContinueGuest}
        />
      ) : !appData.profile ? (
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
                pendingSummary={pendingSummary}
                syncing={syncing}
                onRetrySync={handleSyncNow}
              />
            ) : null}

            {activeTab === "workout" ? (
              <WorkoutScreen
                workouts={appData.workouts}
                onCreateWorkout={handleCreateWorkout}
                onUpdateWorkout={handleUpdateWorkout}
                onDeleteWorkout={handleDeleteWorkout}
              />
            ) : null}

            {activeTab === "knowledge" ? (
              <KnowledgeScreen profile={appData.profile} />
            ) : null}

            {activeTab === "nutrition" ? (
              <NutritionScreen
                profile={appData.profile}
                nutritionLog={nutritionLog}
                onSaveNutrition={handleSaveNutrition}
                onClearNutrition={handleClearNutrition}
              />
            ) : null}

            {activeTab === "progress" ? (
              <ProgressScreen
                profile={appData.profile}
                entries={appData.progressEntries}
                onAddProgress={handleAddProgress}
                onDeleteProgressEntry={handleDeleteProgressEntry}
              />
            ) : null}

            {activeTab === "account" ? (
              <AccountScreen
                profile={appData.profile}
                authEmail={appData.auth.email}
                isGuestMode={appData.auth.userId === "local-user" && !appData.auth.token}
                pendingSummary={pendingSummary}
                syncing={syncing}
                reminderSettings={appData.settings}
                onSaveProfile={handleSaveProfile}
                onSaveReminderSettings={handleSaveReminderSettings}
                onLogout={handleLogout}
                onSyncNow={handleSyncNow}
                onResetAllData={handleResetAllData}
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
