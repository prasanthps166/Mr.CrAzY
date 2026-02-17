import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GOAL_LABELS } from "../constants";
import {
  EVIDENCE_LABELS,
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeCategory,
  type KnowledgeLesson,
  getGoalCategoryPriority,
  getKnowledgeLessons
} from "../content/knowledgeLibrary";
import {
  createEmptyKnowledgeProgress,
  getKnowledgeStats,
  markLessonCompleted,
  pickDailyLessonId,
  recordQuizAttempt,
  type KnowledgeProgress
} from "../state/knowledgeState";
import { colors, radii, spacing } from "../theme";
import { UserProfile } from "../types";
import { toDateKey } from "../utils/date";

interface KnowledgeScreenProps {
  profile: UserProfile;
}

const KNOWLEDGE_PROGRESS_KEY = "@fittrack/knowledge-progress/v1";

function parseKnowledgeProgress(input: unknown): KnowledgeProgress {
  if (!input || typeof input !== "object") {
    return createEmptyKnowledgeProgress();
  }

  const row = input as Partial<KnowledgeProgress>;
  const completedLessonIds = Array.isArray(row.completedLessonIds)
    ? row.completedLessonIds.filter((item): item is string => typeof item === "string")
    : [];
  const learningActivityDates = Array.isArray(row.learningActivityDates)
    ? row.learningActivityDates.filter((item): item is string => typeof item === "string")
    : [];

  const lessonQuizProgress =
    row.lessonQuizProgress && typeof row.lessonQuizProgress === "object"
      ? Object.fromEntries(
          Object.entries(row.lessonQuizProgress).flatMap(([lessonId, value]) => {
            if (!value || typeof value !== "object") {
              return [];
            }
            const entry = value as {
              attempts?: number;
              correct?: number;
              lastAttemptAt?: string;
              lastSelectedIndex?: number;
            };
            const attempts = entry.attempts;
            const correct = entry.correct;
            const lastSelectedIndex = entry.lastSelectedIndex;
            if (
              typeof attempts !== "number" ||
              !Number.isFinite(attempts) ||
              typeof correct !== "number" ||
              !Number.isFinite(correct) ||
              typeof entry.lastAttemptAt !== "string" ||
              typeof lastSelectedIndex !== "number" ||
              !Number.isFinite(lastSelectedIndex)
            ) {
              return [];
            }
            return [
              [
                lessonId,
                {
                  attempts: Math.max(0, Math.round(attempts)),
                  correct: Math.max(0, Math.round(correct)),
                  lastAttemptAt: entry.lastAttemptAt,
                  lastSelectedIndex: Math.max(0, Math.round(lastSelectedIndex))
                }
              ]
            ];
          })
        )
      : {};

  return {
    completedLessonIds,
    learningActivityDates,
    lessonQuizProgress
  };
}

function bulletLabel(index: number): string {
  return `${index + 1}.`;
}

export function KnowledgeScreen({ profile }: KnowledgeScreenProps) {
  const lessons = useMemo(() => getKnowledgeLessons(), []);
  const goalCategoryOrder = useMemo(() => getGoalCategoryPriority(profile.goal), [profile.goal]);
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory>(goalCategoryOrder[0]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [progress, setProgress] = useState<KnowledgeProgress>(createEmptyKnowledgeProgress());
  const [progressLoaded, setProgressLoaded] = useState(false);
  const todayKey = toDateKey();

  useEffect(() => {
    setActiveCategory(goalCategoryOrder[0]);
  }, [goalCategoryOrder]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(KNOWLEDGE_PROGRESS_KEY);
        if (!raw) {
          setProgress(createEmptyKnowledgeProgress());
          return;
        }
        setProgress(parseKnowledgeProgress(JSON.parse(raw)));
      } catch (_error) {
        setProgress(createEmptyKnowledgeProgress());
      } finally {
        setProgressLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!progressLoaded) {
      return;
    }
    AsyncStorage.setItem(KNOWLEDGE_PROGRESS_KEY, JSON.stringify(progress)).catch(() => {
      // Non-blocking save for learning analytics.
    });
  }, [progress, progressLoaded]);

  const prioritizedLessons = useMemo(() => {
    const categoryOrder = new Map(goalCategoryOrder.map((category, index) => [category, index]));
    return [...lessons].sort((a, b) => {
      const aGoal = a.goalTags.includes(profile.goal) ? 0 : 1;
      const bGoal = b.goalTags.includes(profile.goal) ? 0 : 1;
      if (aGoal !== bGoal) {
        return aGoal - bGoal;
      }
      const aCategory = categoryOrder.get(a.category) ?? 99;
      const bCategory = categoryOrder.get(b.category) ?? 99;
      if (aCategory !== bCategory) {
        return aCategory - bCategory;
      }
      return a.title.localeCompare(b.title);
    });
  }, [goalCategoryOrder, lessons, profile.goal]);

  const lessonsById = useMemo(
    () => new Map<string, KnowledgeLesson>(prioritizedLessons.map((item) => [item.id, item])),
    [prioritizedLessons]
  );

  const dailyLesson = useMemo(() => {
    const dailyId = pickDailyLessonId(
      todayKey,
      prioritizedLessons.map((item) => item.id)
    );
    return dailyId ? lessonsById.get(dailyId) ?? null : null;
  }, [lessonsById, prioritizedLessons, todayKey]);

  useEffect(() => {
    if (selectedLessonId && lessonsById.has(selectedLessonId)) {
      return;
    }
    if (dailyLesson) {
      setSelectedLessonId(dailyLesson.id);
      return;
    }
    if (prioritizedLessons.length) {
      setSelectedLessonId(prioritizedLessons[0].id);
    }
  }, [dailyLesson, lessonsById, prioritizedLessons, selectedLessonId]);

  const lessonsForCategory = useMemo(
    () => prioritizedLessons.filter((lesson) => lesson.category === activeCategory),
    [activeCategory, prioritizedLessons]
  );

  const selectedLesson = selectedLessonId ? lessonsById.get(selectedLessonId) ?? null : null;
  const selectedProgress = selectedLesson ? progress.lessonQuizProgress[selectedLesson.id] : undefined;
  const stats = getKnowledgeStats(progress);
  const dailyLessonDone =
    dailyLesson !== null &&
    (progress.lessonQuizProgress[dailyLesson.id]?.lastAttemptAt.slice(0, 10) === todayKey ||
      (progress.completedLessonIds.includes(dailyLesson.id) &&
        progress.learningActivityDates.includes(todayKey)));

  function openCategory(category: KnowledgeCategory) {
    setActiveCategory(category);
    const firstLesson = prioritizedLessons.find((item) => item.category === category);
    if (firstLesson) {
      setSelectedLessonId(firstLesson.id);
    }
  }

  function markCompleted(lessonId: string) {
    setProgress((prev) => markLessonCompleted(prev, lessonId, todayKey));
  }

  function answerQuiz(lesson: KnowledgeLesson, optionIndex: number) {
    const correct = optionIndex === lesson.quiz.correctIndex;
    const attemptedAt = new Date().toISOString();
    setProgress((prev) =>
      recordQuizAttempt(prev, lesson.id, optionIndex, correct, attemptedAt, todayKey)
    );
  }

  function openSource(url: string) {
    void (async () => {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    })();
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Knowledge Hub</Text>
      <Text style={styles.subtitle}>
        Goal: {GOAL_LABELS[profile.goal]} | Learn the fitness industry, supplements, diet, and training from evidence-based lessons.
      </Text>

      <View style={styles.statsCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Lessons Completed</Text>
          <Text style={styles.statValue}>{stats.completedLessons}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Quiz Accuracy</Text>
          <Text style={styles.statValue}>{stats.accuracyPct}%</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Learning Days</Text>
          <Text style={styles.statValue}>{stats.activeDays}</Text>
        </View>
      </View>

      {dailyLesson ? (
        <View style={styles.dailyCard}>
          <Text style={styles.dailyTitle}>Daily Learn</Text>
          <Text style={styles.dailyLesson}>{dailyLesson.title}</Text>
          <Text style={styles.dailyMeta}>
            {KNOWLEDGE_CATEGORY_LABELS[dailyLesson.category]} | {dailyLesson.readMinutes} min | Evidence: {" "}
            {EVIDENCE_LABELS[dailyLesson.evidenceLevel]}
          </Text>
          <Text style={styles.dailySummary}>{dailyLesson.summary}</Text>

          <Pressable
            style={styles.dailyButton}
            onPress={() => {
              setActiveCategory(dailyLesson.category);
              setSelectedLessonId(dailyLesson.id);
            }}
          >
            <Text style={styles.dailyButtonText}>Open Daily Lesson</Text>
          </Pressable>

          <Text style={dailyLessonDone ? styles.dailyDone : styles.dailyPending}>
            {dailyLessonDone ? "Completed today" : "Not completed today"}
          </Text>
        </View>
      ) : null}

      <View style={styles.categorySwitch}>
        {goalCategoryOrder.map((category) => {
          const active = category === activeCategory;
          return (
            <Pressable
              key={category}
              style={[styles.categoryPill, active ? styles.categoryPillActive : undefined]}
              onPress={() => openCategory(category)}
            >
              <Text style={[styles.categoryPillText, active ? styles.categoryPillTextActive : undefined]}>
                {KNOWLEDGE_CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.lessonListCard}>
        <Text style={styles.sectionTitle}>Lessons In {KNOWLEDGE_CATEGORY_LABELS[activeCategory]}</Text>
        {lessonsForCategory.map((lesson) => {
          const completed = progress.completedLessonIds.includes(lesson.id);
          const active = selectedLesson?.id === lesson.id;
          return (
            <Pressable
              key={lesson.id}
              style={[styles.lessonRow, active ? styles.lessonRowActive : undefined]}
              onPress={() => setSelectedLessonId(lesson.id)}
            >
              <View style={styles.lessonMain}>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Text style={styles.lessonMeta}>
                  {lesson.readMinutes} min | Evidence {EVIDENCE_LABELS[lesson.evidenceLevel]}
                </Text>
              </View>
              <Text style={completed ? styles.completed : styles.pending}>
                {completed ? "Done" : "Start"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedLesson ? (
        <View style={styles.lessonDetailCard}>
          <Text style={styles.sectionTitle}>{selectedLesson.title}</Text>
          <Text style={styles.lessonMetaStrong}>
            Evidence: {EVIDENCE_LABELS[selectedLesson.evidenceLevel]} | Last reviewed: {selectedLesson.lastReviewed}
          </Text>
          <Text style={styles.detailSummary}>{selectedLesson.summary}</Text>

          <Text style={styles.sectionLabel}>Key Points</Text>
          {selectedLesson.keyPoints.map((line, index) => (
            <View key={`${selectedLesson.id}-point-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>{bulletLabel(index)}</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Action Steps</Text>
          {selectedLesson.actionSteps.map((line, index) => (
            <View key={`${selectedLesson.id}-action-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>{bulletLabel(index)}</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}

          <View style={styles.mythCard}>
            <Text style={styles.mythLabel}>Myth</Text>
            <Text style={styles.mythText}>{selectedLesson.mythFact.myth}</Text>
            <Text style={styles.factLabel}>Fact</Text>
            <Text style={styles.factText}>{selectedLesson.mythFact.fact}</Text>
          </View>

          <Pressable style={styles.completeButton} onPress={() => markCompleted(selectedLesson.id)}>
            <Text style={styles.completeButtonText}>Mark Lesson Completed</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Quick Quiz</Text>
          <Text style={styles.quizQuestion}>{selectedLesson.quiz.question}</Text>
          {selectedLesson.quiz.options.map((option, index) => {
            const selected = selectedProgress?.lastSelectedIndex === index;
            const correct = index === selectedLesson.quiz.correctIndex;
            const showResult = selectedProgress !== undefined;
            return (
              <Pressable
                key={`${selectedLesson.id}-option-${index}`}
                style={[
                  styles.quizOption,
                  selected ? styles.quizOptionSelected : undefined,
                  showResult && correct ? styles.quizOptionCorrect : undefined,
                  showResult && selected && !correct ? styles.quizOptionWrong : undefined
                ]}
                onPress={() => answerQuiz(selectedLesson, index)}
              >
                <Text style={styles.quizOptionText}>{option}</Text>
              </Pressable>
            );
          })}

          {selectedProgress ? (
            <View style={styles.quizFeedback}>
              <Text style={styles.quizFeedbackText}>
                {selectedProgress.lastSelectedIndex === selectedLesson.quiz.correctIndex
                  ? "Correct. "
                  : "Not correct yet. "}
                {selectedLesson.quiz.explanation}
              </Text>
              <Text style={styles.quizMeta}>
                Attempts: {selectedProgress.attempts} | Correct: {selectedProgress.correct}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Sources</Text>
          {selectedLesson.sources.map((source, index) => (
            <Pressable
              key={`${selectedLesson.id}-source-${index}`}
              style={styles.sourceRow}
              onPress={() => openSource(source.url)}
            >
              <Text style={styles.sourceTitle}>{source.title}</Text>
              <Text style={styles.sourceMeta}>
                {source.organization} | {source.year}
              </Text>
            </Pressable>
          ))}
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
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.inkStrong
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.inkMuted
  },
  statsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  statBlock: {
    alignItems: "center",
    flex: 1
  },
  statLabel: {
    color: colors.inkMuted,
    fontSize: 11
  },
  statValue: {
    marginTop: 2,
    color: colors.inkStrong,
    fontWeight: "800",
    fontSize: 18
  },
  dailyCard: {
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#c6e7d0",
    padding: spacing.md
  },
  dailyTitle: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 16
  },
  dailyLesson: {
    marginTop: spacing.xs,
    color: colors.inkStrong,
    fontWeight: "800",
    fontSize: 17
  },
  dailyMeta: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: 12
  },
  dailySummary: {
    marginTop: spacing.xs,
    color: colors.inkSoft
  },
  dailyButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center"
  },
  dailyButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  dailyDone: {
    marginTop: spacing.xs,
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12
  },
  dailyPending: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontWeight: "700",
    fontSize: 12
  },
  categorySwitch: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card
  },
  categoryPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  categoryPillText: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  categoryPillTextActive: {
    color: colors.accent
  },
  lessonListCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontWeight: "800",
    fontSize: 18
  },
  lessonRow: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  lessonRowActive: {
    borderColor: colors.accent
  },
  lessonMain: {
    flex: 1,
    paddingRight: spacing.sm
  },
  lessonTitle: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  lessonMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2
  },
  completed: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12
  },
  pending: {
    color: colors.warning,
    fontWeight: "700",
    fontSize: 12
  },
  lessonDetailCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md
  },
  lessonMetaStrong: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  detailSummary: {
    marginTop: spacing.sm,
    color: colors.inkSoft
  },
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.inkSoft,
    fontWeight: "800"
  },
  bulletRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  bullet: {
    width: 20,
    color: colors.accent,
    fontWeight: "800"
  },
  bulletText: {
    flex: 1,
    color: colors.inkSoft
  },
  mythCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "#f1d88f",
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm
  },
  mythLabel: {
    color: colors.warning,
    fontWeight: "800"
  },
  mythText: {
    marginTop: 2,
    color: colors.warning
  },
  factLabel: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontWeight: "800"
  },
  factText: {
    marginTop: 2,
    color: colors.inkSoft
  },
  completeButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center"
  },
  completeButtonText: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  quizQuestion: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  quizOption: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  quizOptionSelected: {
    borderColor: colors.inkSoft
  },
  quizOptionCorrect: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  quizOptionWrong: {
    borderColor: colors.danger
  },
  quizOptionText: {
    color: colors.inkSoft,
    fontWeight: "600"
  },
  quizFeedback: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm
  },
  quizFeedbackText: {
    color: colors.inkSoft
  },
  quizMeta: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: 12
  },
  sourceRow: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingTop: spacing.xs
  },
  sourceTitle: {
    color: colors.accent,
    fontWeight: "700"
  },
  sourceMeta: {
    color: colors.inkMuted,
    fontSize: 12
  }
});
