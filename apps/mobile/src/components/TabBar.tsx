import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTab } from "../types";
import { colors, radii, spacing } from "../theme";

interface TabBarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

const TAB_ITEMS: Array<{ key: AppTab; label: string; short: string }> = [
  { key: "dashboard", label: "Dashboard", short: "Home" },
  { key: "workout", label: "Workout", short: "Train" },
  { key: "knowledge", label: "Knowledge", short: "Learn" },
  { key: "nutrition", label: "Nutrition", short: "Fuel" },
  { key: "progress", label: "Progress", short: "Track" },
  { key: "account", label: "Account", short: "You" }
];

export function TabBar({ activeTab, onChangeTab }: TabBarProps) {
  return (
    <View style={styles.container}>
      {TAB_ITEMS.map((item) => {
        const isActive = activeTab === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.tabButton, isActive ? styles.tabButtonActive : undefined]}
            onPress={() => onChangeTab(item.key)}
          >
            <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : undefined]}>
              {item.short}
            </Text>
            <Text style={[styles.tabSubLabel, isActive ? styles.tabSubLabelActive : undefined]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.xs
  },
  tabButton: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: 8,
    alignItems: "center"
  },
  tabButtonActive: {
    backgroundColor: colors.accentSoft
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.tabInactive
  },
  tabLabelActive: {
    color: colors.accent
  },
  tabSubLabel: {
    fontSize: 9,
    color: colors.tabInactive,
    marginTop: 2
  },
  tabSubLabelActive: {
    color: colors.inkSoft
  }
});
