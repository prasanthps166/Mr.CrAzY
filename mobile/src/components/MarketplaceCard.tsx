import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { MarketplacePrompt } from "@/src/types";
import { useTheme } from "@/src/providers/ThemeProvider";

type MarketplaceCardProps = {
  prompt: MarketplacePrompt;
  purchased?: boolean;
  onPress?: () => void;
};

function formatPrice(prompt: MarketplacePrompt) {
  if (prompt.is_free) return "Free";
  return `\u20b9${Number(prompt.price_inr ?? prompt.price).toFixed(2)}`;
}

export function MarketplaceCard({ prompt, purchased = false, onPress }: MarketplaceCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Image source={{ uri: prompt.cover_image_url }} style={styles.image} />
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {prompt.title}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{prompt.category}</Text>
        <View style={styles.row}>
          <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(prompt)}</Text>
          {purchased ? (
            <View style={[styles.purchasedBadge, { backgroundColor: `${colors.accent}22` }]}>
              <Text style={[styles.purchasedText, { color: colors.accent }]}>Owned</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: 140,
  },
  content: {
    padding: 10,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
  },
  purchasedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  purchasedText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
