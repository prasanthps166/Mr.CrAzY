import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CategoryPill } from "@/src/components/CategoryPill";
import { MarketplaceCard } from "@/src/components/MarketplaceCard";
import { CATEGORIES } from "@/src/constants/categories";
import {
  getMarketplacePrompts,
  getMyPurchasedMarketplacePromptIds,
  purchaseMarketplacePrompt,
} from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { MarketplacePrompt } from "@/src/types";

export default function MarketplaceScreen() {
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [category, setCategory] = useState("All");
  const [prompts, setPrompts] = useState<MarketplacePrompt[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<MarketplacePrompt | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const loadData = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const [promptPayload, purchasedPayload] = await Promise.all([
      getMarketplacePrompts(token, {
        category,
        sort: "trending",
        limit: 60,
      }),
      getMyPurchasedMarketplacePromptIds(token),
    ]);

    setPrompts(promptPayload.prompts);
    setPurchasedIds(purchasedPayload.promptIds);
  }, [category, getAccessToken]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    loadData()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadData]);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  async function buyPrompt(prompt: MarketplacePrompt, paymentMethodId?: string) {
    const token = await getAccessToken();
    if (!token) return;

    const payload = await purchaseMarketplacePrompt(token, prompt.id, paymentMethodId);
    if (payload.ok || payload.alreadyPurchased || payload.purchased) {
      setPurchasedIds((current) => (current.includes(prompt.id) ? current : [...current, prompt.id]));
      Alert.alert("Success", payload.alreadyPurchased ? "Prompt already owned." : "Prompt unlocked.");
      return;
    }
  }

  async function onPressPrompt(prompt: MarketplacePrompt) {
    if (purchasedIds.includes(prompt.id)) {
      Alert.alert("Owned", "You already own this prompt.");
      return;
    }

    if (prompt.is_free) {
      try {
        await buyPrompt(prompt);
      } catch (error) {
        Alert.alert("Purchase failed", error instanceof Error ? error.message : "Unable to unlock prompt.");
      }
      return;
    }

    setSelectedPrompt(prompt);
    setPurchaseModalOpen(true);
  }

  async function completeMockPurchase() {
    if (!selectedPrompt) return;

    setPurchasing(true);
    try {
      const paymentId = `rzp_mobile_mock_${Date.now()}`;
      await buyPrompt(selectedPrompt, paymentId);
      setPurchaseModalOpen(false);
      setSelectedPrompt(null);
    } catch (error) {
      Alert.alert("Purchase failed", error instanceof Error ? error.message : "Could not complete payment.");
    } finally {
      setPurchasing(false);
    }
  }

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
        data={prompts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.column}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Marketplace</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Buy premium prompts. Razorpay checkout is mocked in this build.</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <CategoryPill label={item} selected={item === category} onPress={() => setCategory(item)} />
              )}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.muted }}>No marketplace prompts available.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <MarketplaceCard
              prompt={item}
              purchased={purchasedIds.includes(item.id)}
              onPress={() => {
                void onPressPrompt(item);
              }}
            />
          </View>
        )}
      />

      <Modal visible={purchaseModalOpen} animationType="slide" transparent onRequestClose={() => setPurchaseModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Purchase Prompt</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              {selectedPrompt?.title} - {selectedPrompt?.is_free ? "Free" : `\u20b9${Number(selectedPrompt?.price_inr ?? selectedPrompt?.price ?? 0).toFixed(2)}`}
            </Text>
            <Text style={[styles.modalCaption, { color: colors.muted }]}>This screen uses mock Razorpay purchase IDs for now.</Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPurchaseModalOpen(false)}
                style={[styles.modalButton, { borderColor: colors.border }]}
                disabled={purchasing}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void completeMockPurchase()}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Pay</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 26,
  },
  header: {
    paddingTop: 54,
    paddingBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  column: {
    justifyContent: "space-between",
  },
  gridItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  modalCaption: {
    marginTop: 6,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
