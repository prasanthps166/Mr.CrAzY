import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryPill } from "@/src/components/CategoryPill";
import { AdMobBanner } from "@/src/components/AdMobBanner";
import { PromptCard } from "@/src/components/PromptCard";
import { CATEGORIES } from "@/src/constants/categories";
import { getPrompts } from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Prompt } from "@/src/types";

export default function HomeScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [featured, setFeatured] = useState<Prompt[]>([]);
  const [trending, setTrending] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPrompts = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const [featuredData, trendingData] = await Promise.all([
      getPrompts(token, {
        featuredOnly: true,
        limit: 10,
      }),
      getPrompts(token, {
        category,
        search: query.trim(),
        sort: "trending",
        limit: 30,
      }),
    ]);

    setFeatured(featuredData.prompts);
    setTrending(trendingData.prompts);
  }, [category, getAccessToken, query]);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      setLoading(true);
      loadPrompts()
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadPrompts]);

  const header = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Discover Prompts</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search prompts, tags, categories..."
          placeholderTextColor={colors.muted}
          style={[
            styles.searchInput,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.card,
            },
          ]}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((item) => (
            <CategoryPill
              key={item}
              label={item}
              selected={category === item}
              onPress={() => {
                setCategory(item);
              }}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>India Special</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featured
            .filter((prompt) => prompt.category === "India Special")
            .slice(0, 8)
            .map((prompt) => (
            <View key={prompt.id} style={styles.featuredCardWrap}>
              <PromptCard prompt={prompt} large onPress={() => router.push(`/prompt/${prompt.id}`)} />
            </View>
          ))}
          {!featured.length && !loading ? (
            <View
              style={[
                styles.emptyBlock,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Text style={{ color: colors.muted }}>No featured prompts found.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending</Text>
        </View>

        <AdMobBanner position="bottom" />
      </View>
    ),
    [category, colors.border, colors.card, colors.muted, colors.text, featured, loading, query, router],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trending}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          columnWrapperStyle={styles.column}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                loadPrompts()
                  .catch(() => undefined)
                  .finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.muted }}>No prompts matched your filters.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridCard}>
              <Pressable onPress={() => router.push(`/prompt/${item.id}`)}>
                <PromptCard prompt={item} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  headerContainer: {
    paddingTop: 54,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  categoryRow: {
    paddingBottom: 8,
    paddingRight: 10,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  featuredCardWrap: {
    marginRight: 12,
    width: 260,
  },
  column: {
    justifyContent: "space-between",
  },
  gridCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  emptyWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  emptyBlock: {
    width: 260,
    height: 160,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});
