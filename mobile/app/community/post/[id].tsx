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

import { getCommunityPost, likeCommunityPost } from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { CommunityPost } from "@/src/types";

export default function CommunityPostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const token = await getAccessToken();
      if (!token || !id) return;

      try {
        const payload = await getCommunityPost(token, id);
        if (!active) return;
        setPost(payload.post);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [getAccessToken, id]);

  async function likePost() {
    if (!post) return;
    const token = await getAccessToken();
    if (!token) return;

    const previousLikes = post.likes;
    setPost({ ...post, likes: previousLikes + 1 });
    try {
      const payload = await likeCommunityPost(token, post.id);
      setPost((current) => (current ? { ...current, likes: payload.likes } : current));
    } catch {
      setPost((current) => (current ? { ...current, likes: previousLikes } : current));
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>Post not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={{ uri: post.generated_image_url }} style={styles.heroImage} />
      <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: "rgba(15,23,42,0.65)" }]}>
        <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
      </Pressable>

      <ScrollView style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{post.prompt_title}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{post.prompt_description ?? "Community post"}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          by {post.username} • {new Date(post.created_at).toLocaleDateString()}
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={() => void likePost()} style={[styles.likeButton, { borderColor: colors.border }]}>
            <Text style={[styles.likeText, { color: colors.primary }]}>❤ {post.likes}</Text>
          </Pressable>
          <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}18` }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>{post.prompt_category}</Text>
          </View>
        </View>
      </ScrollView>
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
  heroImage: {
    width: "100%",
    height: 430,
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
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  likeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  categoryBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
