import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Prompt } from "@/src/types";
import { useTheme } from "@/src/providers/ThemeProvider";

type PromptCardProps = {
  prompt: Prompt;
  onPress?: () => void;
  large?: boolean;
};

export function PromptCard({ prompt, onPress, large = false }: PromptCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: large ? 260 : "100%",
        },
      ]}
    >
      <Image
        source={{ uri: prompt.example_image_url }}
        style={[styles.image, { height: large ? 180 : 140 }]}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: `${colors.primary}1A`,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.primary }]}>{prompt.category}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {prompt.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: {
    width: "100%",
  },
  content: {
    padding: 10,
    gap: 8,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
});
