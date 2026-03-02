import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getCredits, getGenerationHistory, getProfile } from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { GenerationHistoryItem, Profile } from "@/src/types";

function firstLetter(name?: string | null) {
  if (!name?.trim()) return "U";
  return name.trim().slice(0, 1).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const { getAccessToken, signOut } = useAuth();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled } = useNotifications();
  const { theme, setTheme, colors } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const [profilePayload, historyPayload] = await Promise.all([
      getProfile(token),
      getGenerationHistory(token, 60),
    ]);

    setProfile(profilePayload.profile);
    setHistory(historyPayload.history);
  }, [getAccessToken]);

  useEffect(() => {
    let active = true;
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

  async function openPricing() {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return;
    await Linking.openURL(`${apiUrl.replace(/\/$/, "")}/pricing`);
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  async function claimDailyLoginBonus() {
    const token = await getAccessToken();
    if (!token) return;
    const payload = await getCredits(token);
    setProfile((current) =>
      current
        ? {
            ...current,
            credits: payload.credits,
            is_pro: payload.isPro,
          }
        : current,
    );
  }

  async function shareReferral() {
    const code = profile?.referral_code;
    if (!code) return;
    const appUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const link = `${appUrl}/signup?ref=${encodeURIComponent(code)}`;
    await Share.share({
      message: `Join PromptGallery and get free credits: ${link}`,
    });
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
        data={history}
        numColumns={3}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.column}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

            <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={[styles.avatarLetter, { color: colors.primary }]}>{firstLetter(profile?.full_name)}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name ?? profile?.email ?? "User"}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{profile?.email}</Text>
              </View>
              <View style={[styles.creditBadge, { backgroundColor: `${colors.accent}20` }]}>
                <Text style={[styles.creditText, { color: colors.accent }]}>{profile?.credits ?? 0} credits</Text>
              </View>
            </View>

            <Pressable onPress={() => void openPricing()} style={[styles.upgradeButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.upgradeText}>{profile?.is_pro ? "Manage Pro Plan" : "Upgrade to Pro"}</Text>
            </Pressable>

            <View style={styles.quickActions}>
              <Pressable
                onPress={() => void claimDailyLoginBonus()}
                style={[styles.quickButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.quickButtonText, { color: colors.text }]}>Claim Daily Bonus</Text>
              </Pressable>
              <Pressable
                onPress={() => void shareReferral()}
                style={[styles.quickButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.quickButtonText, { color: colors.text }]}>Share Referral</Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
              Referral code: {profile?.referral_code ?? "-"}
            </Text>

            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>

              <Pressable
                onPress={() => void setNotificationsEnabled(!notificationsEnabled)}
                style={[styles.settingRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="notifications-outline" size={17} color={colors.muted} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications</Text>
                </View>
                <Text style={{ color: colors.muted }}>{notificationsEnabled ? "On" : "Off"}</Text>
              </Pressable>

              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingLeft}>
                  <Ionicons name="color-palette-outline" size={17} color={colors.muted} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
                </View>
                <View style={styles.themeButtons}>
                  {(["light", "dark", "system"] as const).map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => void setTheme(item)}
                      style={[
                        styles.themeButton,
                        {
                          borderColor: theme === item ? colors.primary : colors.border,
                          backgroundColor: theme === item ? `${colors.primary}20` : "transparent",
                        },
                      ]}
                    >
                      <Text style={{ color: theme === item ? colors.primary : colors.muted, fontSize: 12 }}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable onPress={() => void logout()} style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="log-out-outline" size={17} color={colors.danger} />
                  <Text style={[styles.settingLabel, { color: colors.danger }]}>Logout</Text>
                </View>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Generation History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.muted }}>No generation history yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Image source={{ uri: item.generated_image_url }} style={[styles.historyImage, { borderColor: colors.border }]} />
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
    paddingTop: 54,
    paddingBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "800",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
  },
  creditBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  creditText: {
    fontSize: 12,
    fontWeight: "700",
  },
  upgradeButton: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 13,
    marginTop: 12,
    marginBottom: 10,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  settingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  settingsTitle: {
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 16,
    fontWeight: "800",
  },
  settingRow: {
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  themeButtons: {
    flexDirection: "row",
    gap: 6,
  },
  themeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  column: {
    justifyContent: "space-between",
  },
  historyImage: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 8,
    height: 118,
    borderRadius: 10,
    borderWidth: 1,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
});
