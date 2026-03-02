import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { ONBOARDING_DONE_KEY } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function SplashScreen() {
  const router = useRouter();
  const { initialized, session } = useAuth();
  const { colors } = useTheme();
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (!initialized) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;

      const hasSeenOnboarding = (await AsyncStorage.getItem(ONBOARDING_DONE_KEY)) === "true";
      if (!hasSeenOnboarding) {
        router.replace("/onboarding");
        return;
      }

      if (session?.access_token) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/login");
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialized, router, session?.access_token]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.logo,
          {
            backgroundColor: colors.primary,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Text style={styles.logoText}>PG</Text>
      </Animated.View>
      <Text style={[styles.title, { color: colors.text }]}>PromptGallery</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>AI Prompt Studio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
  },
});
