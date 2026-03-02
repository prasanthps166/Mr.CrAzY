import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdMobBanner } from "@/src/components/AdMobBanner";
import { CategoryPill } from "@/src/components/CategoryPill";
import { CATEGORIES } from "@/src/constants/categories";
import { getCommunityFeed, likeCommunityPost } from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { CommunityPost } from "@/src/types";

type CommunityCardProps = {
  post: CommunityPost;
  onOpen: (postId: string) => void;
  onLike: (postId: string, currentLikes: number) => Promise<void>;
  colors: {
    text: string;
    muted: string;
    border: string;
    primary: string;
    card: string;
  };
};

function CommunityCard({ post, onOpen, onLike, colors }: CommunityCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  async function handleLike() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();

    await onLike(post.id, post.likes);
  }

  return (
    <Pressable onPress={() => onOpen(post.id)} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Image source={{ uri: post.generated_image_url }} style={styles.cardImage} />
      <View style={styles.cardFooter}>
        <Text numberOfLines={1} style={[styles.cardUser, { color: colors.text }]}>
          {post.username}
        </Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable onPress={() => void handleLike()} style={[styles.likeButton, { borderColor: colors.border }]}>
            <Text style={[styles.likeButtonText, { color: colors.primary }]}>Like {post.likes}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      const token = await getAccessToken();
      if (!token) return;

      const payload = await getCommunityFeed(token, {
        offset: nextOffset,
        limit: 20,
        category: selectedCategory,
      });

      setPosts((current) => (replace ? payload.posts : [...current, ...payload.posts]));
      setOffset(payload.nextOffset);
      setHasMore(payload.hasMore);
    },
    [getAccessToken, selectedCategory],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOffset(0);
    setHasMore(true);

    fetchPage(0, true)
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPage]);

  async function refresh() {
    setRefreshing(true);
    try {
      await fetchPage(0, true);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await fetchPage(offset, false);
    } finally {
      setLoadingMore(false);
    }
  }

  async function likePost(postId: string, currentLikes: number) {
    const token = await getAccessToken();
    if (!token) return;

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: currentLikes + 1,
            }
          : post,
      ),
    );

    try {
      const payload = await likeCommunityPost(token, postId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: payload.likes,
              }
            : post,
        ),
      );
    } catch {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: currentLikes,
              }
            : post,
        ),
      );
    }
  }

  const header = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.text }]}>Community</Text>
        <AdMobBanner position="top" />
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <CategoryPill label={item} selected={item === selectedCategory} onPress={() => setSelectedCategory(item)} />
          )}
        />
      </View>
    ),
    [colors.text, selectedCategory],
  );

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.muted }}>No community posts found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <CommunityCard
              post={item}
              onOpen={(postId) => router.push(`/community/post/${postId}`)}
              onLike={likePost}
              colors={{
                text: colors.text,
                muted: colors.muted,
                border: colors.border,
                primary: colors.primary,
                card: colors.card,
              }}
            />
          </View>
        )}
      />
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
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 22,
  },
  headerWrap: {
    paddingTop: 54,
    paddingBottom: 10,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  column: {
    justifyContent: "space-between",
  },
  gridItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardImage: {
    width: "100%",
    height: 160,
  },
  cardFooter: {
    padding: 10,
    gap: 8,
  },
  cardUser: {
    fontSize: 13,
    fontWeight: "700",
  },
  likeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  likeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  footerLoading: {
    paddingVertical: 10,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
});
