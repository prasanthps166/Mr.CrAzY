import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, spacing } from "../theme";
import { ProgressDraft, ProgressEntry, UserProfile } from "../types";
import { formatDateLabel } from "../utils/date";

interface ProgressScreenProps {
  profile: UserProfile;
  entries: ProgressEntry[];
  onAddProgress: (draft: ProgressDraft) => void;
  onDeleteProgressEntry: (id: string) => void;
}

export function ProgressScreen({ profile, entries, onAddProgress, onDeleteProgressEntry }: ProgressScreenProps) {
  const [weightText, setWeightText] = useState(String(profile.currentWeightKg));
  const [bodyFatText, setBodyFatText] = useState("");
  const [waistText, setWaistText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trend = useMemo(() => {
    if (entries.length < 2) {
      return null;
    }
    const latest = entries[0].weightKg;
    const previous = entries[1].weightKg;
    return Number((latest - previous).toFixed(1));
  }, [entries]);

  function submit() {
    const weightKg = Number(weightText);
    const bodyFatPct = bodyFatText ? Number(bodyFatText) : undefined;
    const waistCm = waistText ? Number(waistText) : undefined;

    if (!Number.isFinite(weightKg) || weightKg < 35 || weightKg > 220) {
      setError("Weight must be between 35 and 220 kg.");
      return;
    }

    if (bodyFatPct !== undefined && (!Number.isFinite(bodyFatPct) || bodyFatPct < 2 || bodyFatPct > 70)) {
      setError("Body fat must be between 2% and 70%.");
      return;
    }

    if (waistCm !== undefined && (!Number.isFinite(waistCm) || waistCm < 40 || waistCm > 180)) {
      setError("Waist must be between 40 and 180 cm.");
      return;
    }

    setError(null);
    onAddProgress({ weightKg, bodyFatPct, waistCm });
    setBodyFatText("");
    setWaistText("");
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Track body changes weekly to verify your plan is working.</Text>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Weight (kg)</Text>
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="72"
        />

        <Text style={styles.fieldLabel}>Body Fat % (optional)</Text>
        <TextInput
          value={bodyFatText}
          onChangeText={setBodyFatText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="18"
        />

        <Text style={styles.fieldLabel}>Waist (cm) (optional)</Text>
        <TextInput
          value={waistText}
          onChangeText={setWaistText}
          keyboardType="numeric"
          style={styles.input}
          placeholder="82"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>Save Progress Entry</Text>
        </Pressable>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>History</Text>
        {trend !== null ? (
          <Text style={styles.trendText}>
            Last change: {trend > 0 ? "+" : ""}
            {trend} kg
          </Text>
        ) : null}

        {entries.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet.</Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View>
                <Text style={styles.entryWeight}>{entry.weightKg} kg</Text>
                <Text style={styles.entryDate}>{formatDateLabel(entry.date)}</Text>
              </View>
              <View style={styles.entryOptional}>
                {entry.bodyFatPct !== undefined ? (
                  <Text style={styles.optionalText}>BF {entry.bodyFatPct}%</Text>
                ) : null}
                {entry.waistCm !== undefined ? (
                  <Text style={styles.optionalText}>Waist {entry.waistCm} cm</Text>
                ) : null}
                <Pressable style={styles.deleteButton} onPress={() => onDeleteProgressEntry(entry.id)}>
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
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "#f8fbf6",
    color: colors.inkStrong
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
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  historyTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: "800"
  },
  trendText: {
    marginTop: spacing.xs,
    color: colors.accent,
    fontWeight: "700"
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.inkMuted
  },
  entryRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#ecf2e8",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  entryWeight: {
    color: colors.inkSoft,
    fontWeight: "800"
  },
  entryDate: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: 12
  },
  entryOptional: {
    alignItems: "flex-end",
    gap: 2
  },
  optionalText: {
    color: colors.inkMuted,
    fontSize: 12
  },
  deleteButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  deleteText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "700"
  }
});
