import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";

type CategoryPillProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CategoryPill({ label, selected = false, onPress }: CategoryPillProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.card,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? "#FFFFFF" : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
