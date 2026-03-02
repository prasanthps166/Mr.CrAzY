import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ONBOARDING_DONE_KEY } from "@/src/lib/storage";
import { useTheme } from "@/src/providers/ThemeProvider";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "discover",
    title: "Discover AI Styles",
    description: "Browse hundreds of prompt styles.",
  },
  {
    id: "transform",
    title: "Upload & Transform",
    description: "Turn your photos into art.",
  },
  {
    id: "share",
    title: "Share with the World",
    description: "Join the community.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);

  const isLast = currentIndex === slides.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, "true");
    router.replace("/login");
  }

  const dots = useMemo(
    () =>
      slides.map((slide, index) => (
        <View
          key={slide.id}
          style={[
            styles.dot,
            {
              width: index === currentIndex ? 24 : 8,
              backgroundColor: index === currentIndex ? colors.primary : colors.border,
            },
          ]}
        />
      )),
    [colors.border, colors.primary, currentIndex],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topActions}>
        <Pressable onPress={finish}>
          <Text style={[styles.skip, { color: colors.muted }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        data={slides}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(next);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.hero, { backgroundColor: `${colors.primary}20` }]} />
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>{dots}</View>
        <Pressable
          onPress={() => {
            if (isLast) {
              void finish();
              return;
            }
            const nextIndex = Math.min(slides.length - 1, currentIndex + 1);
            listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
          }}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>{isLast ? "Get Started" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topActions: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 58,
  },
  skip: {
    fontSize: 14,
    fontWeight: "600",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  hero: {
    width: 220,
    height: 220,
    borderRadius: 28,
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 18,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 99,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
