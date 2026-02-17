import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GOAL_LABELS } from "../constants";
import { colors, radii, spacing } from "../theme";
import { FitnessGoal, UserProfile } from "../types";

interface KnowledgeScreenProps {
  profile: UserProfile;
}

type KnowledgeTopic = "training" | "nutrition" | "recovery" | "safety";

const TOPIC_ORDER: KnowledgeTopic[] = ["training", "nutrition", "recovery", "safety"];

const TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  safety: "Safety"
};

const GOAL_PLAYBOOK: Record<FitnessGoal, string[]> = {
  lose_weight: [
    "Prioritize 3-4 lifting sessions weekly to keep muscle while cutting fat.",
    "Target a moderate calorie deficit and keep protein high every day.",
    "Use daily steps plus low intensity cardio to increase calorie burn."
  ],
  gain_muscle: [
    "Train each muscle group 2 times per week with progressive overload.",
    "Stay in a small calorie surplus with consistent protein intake.",
    "Log key lifts weekly and push reps or load when form stays clean."
  ],
  maintain: [
    "Keep 3-5 balanced sessions weekly across strength, cardio, and mobility.",
    "Match calories to activity and protect protein and sleep quality.",
    "Use performance goals to stay motivated while body weight stays stable."
  ]
};

const TOPIC_CONTENT: Record<
  KnowledgeTopic,
  { headline: string; principles: string[]; actionList: string[] }
> = {
  training: {
    headline: "Build muscle and strength with repeatable structure.",
    principles: [
      "Use progressive overload: more reps, load, or total sets over time.",
      "Keep 1-3 reps in reserve on most working sets for quality output.",
      "Aim for 10-20 hard sets per muscle group weekly based on recovery.",
      "Base sessions around compound lifts, then add focused accessories."
    ],
    actionList: [
      "Choose 4 key lifts and track them every session.",
      "Plan your next workout before leaving the gym.",
      "Record effort, not just numbers, to spot fatigue early."
    ]
  },
  nutrition: {
    headline: "Fuel training and body composition with clear targets.",
    principles: [
      "Set calories to your goal and keep weekly consistency first.",
      "Protein baseline: roughly 1.6-2.2 g per kg bodyweight daily.",
      "Center carbs around workouts for better training quality.",
      "Hydrate well and keep micronutrient variety from whole foods."
    ],
    actionList: [
      "Pre-log your main meals to stay within calorie target.",
      "Hit protein target before optimizing smaller details.",
      "Keep a simple repeatable meal template for busy days."
    ]
  },
  recovery: {
    headline: "Recovery drives adaptation, not just training stress.",
    principles: [
      "Sleep 7-9 hours to support performance, hormone health, and appetite control.",
      "Use one lower-stress day each week to maintain long-term consistency.",
      "Manage total life stress because it affects gym output and progress.",
      "Deload every 4-8 weeks or when performance and motivation drop."
    ],
    actionList: [
      "Set a fixed sleep window and protect it like a workout.",
      "Do 5-10 minutes of cooldown mobility after hard sessions.",
      "Track morning energy and soreness to adjust volume early."
    ]
  },
  safety: {
    headline: "Train hard, but keep form and longevity first.",
    principles: [
      "Warm up with movement prep and ramp sets for first big lifts.",
      "Use full controlled range of motion that you can own safely.",
      "Stop sets when form breaks instead of forcing extra reps.",
      "Pain during movement is a signal to modify, reduce load, or stop."
    ],
    actionList: [
      "Film one set per main lift each week for form review.",
      "Avoid ego jumps in load; use small increments consistently.",
      "If pain persists, switch variations and seek professional guidance."
    ]
  }
};

const EXERCISE_LIBRARY: Array<{
  group: string;
  items: Array<{ name: string; sets: string; reps: string; cue: string }>;
}> = [
  {
    group: "Upper Push",
    items: [
      {
        name: "Barbell Bench Press",
        sets: "3-5",
        reps: "5-8",
        cue: "Keep shoulder blades tight and drive feet into the floor."
      },
      {
        name: "Incline Dumbbell Press",
        sets: "3-4",
        reps: "8-12",
        cue: "Lower under control and press through full lockout."
      }
    ]
  },
  {
    group: "Upper Pull",
    items: [
      {
        name: "Lat Pulldown",
        sets: "3-4",
        reps: "8-12",
        cue: "Lead with elbows and avoid leaning back excessively."
      },
      {
        name: "Chest Supported Row",
        sets: "3-4",
        reps: "8-12",
        cue: "Pause briefly at contraction to reduce momentum."
      }
    ]
  },
  {
    group: "Lower Body",
    items: [
      {
        name: "Back Squat",
        sets: "3-5",
        reps: "4-8",
        cue: "Brace before each rep and keep knees tracking over toes."
      },
      {
        name: "Romanian Deadlift",
        sets: "3-4",
        reps: "6-10",
        cue: "Push hips back and keep bar close to legs throughout."
      }
    ]
  },
  {
    group: "Core and Conditioning",
    items: [
      {
        name: "Cable Crunch",
        sets: "3-4",
        reps: "10-15",
        cue: "Move through spine flexion instead of pulling with arms."
      },
      {
        name: "Bike or Rower Intervals",
        sets: "8-12",
        reps: "30 sec hard",
        cue: "Keep work intervals hard and rest intervals controlled."
      }
    ]
  }
];

const COMMON_MISTAKES = [
  "Changing programs every week before progression can happen.",
  "Ignoring protein and sleep while chasing complex supplements.",
  "Training to failure every set and stalling from accumulated fatigue.",
  "Skipping warmups and then loading heavy too quickly."
];

function bulletLabel(index: number): string {
  return `${index + 1}.`;
}

export function KnowledgeScreen({ profile }: KnowledgeScreenProps) {
  const [activeTopic, setActiveTopic] = useState<KnowledgeTopic>("training");
  const topic = TOPIC_CONTENT[activeTopic];
  const weeklyFocus = useMemo(
    () =>
      profile.goal === "gain_muscle"
        ? "Weekly focus: 4-5 sessions, higher volume, clear overload targets."
        : profile.goal === "lose_weight"
          ? "Weekly focus: 3-4 sessions, hold strength, maintain protein adherence."
          : "Weekly focus: 3-5 sessions, balanced strength and conditioning mix.",
    [profile.goal]
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Gym Knowledge Hub</Text>
      <Text style={styles.subtitle}>Your one place for training, nutrition, and recovery guidance.</Text>

      <View style={styles.goalCard}>
        <Text style={styles.goalTitle}>Goal Playbook: {GOAL_LABELS[profile.goal]}</Text>
        <Text style={styles.goalMeta}>{weeklyFocus}</Text>
        {GOAL_PLAYBOOK[profile.goal].map((line, index) => (
          <View key={`${profile.goal}-${index}`} style={styles.bulletRow}>
            <Text style={styles.bullet}>{bulletLabel(index)}</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.topicSwitch}>
        {TOPIC_ORDER.map((topicKey) => {
          const active = activeTopic === topicKey;
          return (
            <Pressable
              key={topicKey}
              style={[styles.topicPill, active ? styles.topicPillActive : undefined]}
              onPress={() => setActiveTopic(topicKey)}
            >
              <Text style={[styles.topicPillText, active ? styles.topicPillTextActive : undefined]}>
                {TOPIC_LABELS[topicKey]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.topicCard}>
        <Text style={styles.topicHeadline}>{topic.headline}</Text>
        <Text style={styles.sectionLabel}>Core Principles</Text>
        {topic.principles.map((line, index) => (
          <View key={`${activeTopic}-principle-${index}`} style={styles.bulletRow}>
            <Text style={styles.bullet}>{bulletLabel(index)}</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
        <Text style={styles.sectionLabel}>Do This Today</Text>
        {topic.actionList.map((line, index) => (
          <View key={`${activeTopic}-action-${index}`} style={styles.bulletRow}>
            <Text style={styles.bullet}>{bulletLabel(index)}</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.libraryCard}>
        <Text style={styles.libraryTitle}>Exercise Library</Text>
        <Text style={styles.librarySubtitle}>Reliable movements with practical set and rep ranges.</Text>
        {EXERCISE_LIBRARY.map((section) => (
          <View key={section.group} style={styles.librarySection}>
            <Text style={styles.librarySectionTitle}>{section.group}</Text>
            {section.items.map((exercise) => (
              <View key={`${section.group}-${exercise.name}`} style={styles.exerciseRow}>
                <View style={styles.exerciseMain}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseCue}>{exercise.cue}</Text>
                </View>
                <View style={styles.exerciseVolume}>
                  <Text style={styles.volumeText}>{exercise.sets} sets</Text>
                  <Text style={styles.volumeText}>{exercise.reps}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.mistakeCard}>
        <Text style={styles.mistakeTitle}>Common Mistakes To Avoid</Text>
        {COMMON_MISTAKES.map((line, index) => (
          <View key={`mistake-${index}`} style={styles.bulletRow}>
            <Text style={styles.bullet}>{bulletLabel(index)}</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
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
  goalCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#c6e7d0",
    padding: spacing.md
  },
  goalTitle: {
    color: colors.inkStrong,
    fontSize: 17,
    fontWeight: "800"
  },
  goalMeta: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.inkSoft,
    fontWeight: "700"
  },
  topicSwitch: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  topicPill: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card
  },
  topicPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  topicPillText: {
    color: colors.inkSoft,
    fontWeight: "700"
  },
  topicPillTextActive: {
    color: colors.accent
  },
  topicCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  topicHeadline: {
    color: colors.inkStrong,
    fontSize: 17,
    fontWeight: "800"
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
    color: colors.inkSoft,
    lineHeight: 19
  },
  libraryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  libraryTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: "800"
  },
  librarySubtitle: {
    marginTop: spacing.xs,
    color: colors.inkMuted
  },
  librarySection: {
    marginTop: spacing.md
  },
  librarySectionTitle: {
    color: colors.inkSoft,
    fontWeight: "800"
  },
  exerciseRow: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    paddingTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  exerciseMain: {
    flex: 1
  },
  exerciseName: {
    color: colors.inkStrong,
    fontWeight: "700"
  },
  exerciseCue: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: 12
  },
  exerciseVolume: {
    alignItems: "flex-end"
  },
  volumeText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12
  },
  mistakeCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "#f1d88f",
    borderRadius: radii.lg,
    padding: spacing.md
  },
  mistakeTitle: {
    color: colors.warning,
    fontSize: 17,
    fontWeight: "800"
  }
});
