import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getPrompt, getPromptCommunity } from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { CommunityPost, Prompt } from "@/src/types";

export default function PromptDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const token = await getAccessToken();
      if (!token || !id) return;

      try {
        const [promptPayload, communityPayload] = await Promise.all([
          getPrompt(token, id),
          getPromptCommunity(token, id, 12),
        ]);
        if (!active) return;
        setPrompt(promptPayload.prompt);
        setCommunity(communityPayload.results);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [getAccessToken, id]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!prompt) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>Prompt not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: prompt.example_image_url }} style={styles.heroImage} />
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: "rgba(17, 24, 39, 0.6)" }]}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.text }]}>{prompt.title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{prompt.description}</Text>

          <View style={styles.tagsRow}>
            {prompt.tags?.map((tag) => (
              <View key={tag} style={[styles.tag, { borderColor: colors.border, backgroundColor: `${colors.primary}15` }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>#{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Community Results</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {community.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/community/post/${item.id}`)}
                style={[styles.communityCard, { borderColor: colors.border }]}
              >
                <Image source={{ uri: item.generated_image_url }} style={styles.communityImage} />
                <Text numberOfLines={1} style={[styles.communityLabel, { color: colors.text }]}>
                  {item.username}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScrollView>
      </View>

      <View style={[styles.ctaWrap, { backgroundColor: `${colors.background}EE`, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => router.push({ pathname: "/(tabs)/generate", params: { promptId: prompt.id } })}
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.ctaText}>Transform My Photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrap: {
    height: 340,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  description: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: "700",
  },
  communityCard: {
    width: 130,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 10,
  },
  communityImage: {
    width: "100%",
    height: 120,
  },
  communityLabel: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaButton: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
