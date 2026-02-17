import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, spacing } from "../theme";

interface AuthResult {
  ok: boolean;
  message?: string;
}

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onRegister: (email: string, password: string) => Promise<AuthResult>;
  onContinueGuest: () => void;
}

type AuthMode = "login" | "register";

export function AuthScreen({ onLogin, onRegister, onContinueGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await onRegister(normalizedEmail, password)
          : await onLogin(normalizedEmail, password);

      if (!result.ok) {
        setError(result.message ?? "Authentication failed.");
      }
    } catch (_error) {
      setError("Could not connect to the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.brand}>PulseFit</Text>
        <Text style={styles.title}>Sign in to sync your progress</Text>
        <Text style={styles.subtitle}>
          Create an account to keep your workouts and nutrition data on any device.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === "login" ? styles.modeButtonActive : undefined]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.modeButtonText, mode === "login" ? styles.modeButtonTextActive : undefined]}>
              Login
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "register" ? styles.modeButtonActive : undefined]}
            onPress={() => setMode("register")}
          >
            <Text style={[styles.modeButtonText, mode === "register" ? styles.modeButtonTextActive : undefined]}>
              Register
            </Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="At least 6 characters"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        {mode === "register" ? (
          <>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit} disabled={submitting}>
          <Text style={styles.primaryButtonText}>
            {submitting
              ? "Please wait..."
              : mode === "register"
                ? "Create Account"
                : "Login"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onContinueGuest} disabled={submitting}>
          <Text style={styles.secondaryButtonText}>Continue in Offline Mode</Text>
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
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#f1f6ef",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xs,
    marginBottom: spacing.sm
  },
  modeButton: {
    flex: 1,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    alignItems: "center"
  },
  modeButtonActive: {
    backgroundColor: colors.accentSoft
  },
  modeButtonText: {
    color: colors.inkMuted,
    fontWeight: "700"
  },
  modeButtonTextActive: {
    color: colors.accent
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
  },
  secondaryButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    alignItems: "center",
    paddingVertical: spacing.md
  },
  secondaryButtonText: {
    color: colors.inkSoft,
    fontWeight: "700"
  }
});
