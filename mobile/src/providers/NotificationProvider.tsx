import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getMyCommunityPosts } from "@/src/lib/api";
import {
  disableDailyCreditsNotification,
  disableWeeklyPromptsNotification,
  ensureDailyCreditsNotification,
  ensureWeeklyPromptsNotification,
  notifyCommunityLike,
  registerForPushNotificationsAsync,
} from "@/src/lib/notifications";
import { useAuth } from "@/src/providers/AuthProvider";

type NotificationContextValue = {
  enabled: boolean;
  pushToken: string | null;
  setEnabled: (next: boolean) => Promise<void>;
};

const NOTIFICATION_ENABLED_KEY = "pg_mobile_notifications_enabled";
const LIKE_CACHE_KEY = "pg_mobile_like_cache";
const NotificationContext = createContext<NotificationContextValue | null>(null);

function toLikeCache(rows: Array<{ id: string; likes: number }>) {
  const cache: Record<string, number> = {};
  for (const row of rows) cache[row.id] = row.likes;
  return cache;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { initialized, user, getAccessToken } = useAuth();
  const [enabled, setEnabledState] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY)
      .then((stored) => {
        if (stored === "false") {
          setEnabledState(false);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) {
      void disableDailyCreditsNotification();
      void disableWeeklyPromptsNotification();
      return;
    }

    void ensureDailyCreditsNotification();
    void ensureWeeklyPromptsNotification();
    void registerForPushNotificationsAsync().then((token) => {
      setPushToken(token);
    });
  }, [enabled]);

  useEffect(() => {
    if (!initialized || !user || !enabled) return;

    let stopped = false;

    async function pollLikeNotifications() {
      const token = await getAccessToken();
      if (!token || stopped) return;

      try {
        const payload = await getMyCommunityPosts(token, 100);
        if (stopped) return;

        const current = payload.posts;
        const nextCache = toLikeCache(current);
        const storedRaw = await AsyncStorage.getItem(LIKE_CACHE_KEY);
        const stored = storedRaw ? (JSON.parse(storedRaw) as Record<string, number>) : null;

        if (stored) {
          for (const row of current) {
            const previousLikes = stored[row.id];
            if (typeof previousLikes === "number" && row.likes > previousLikes) {
              await notifyCommunityLike("Your community post");
            }
          }
        }

        await AsyncStorage.setItem(LIKE_CACHE_KEY, JSON.stringify(nextCache));
      } catch {
        // Keep polling silent to avoid interrupting UX.
      }
    }

    void pollLikeNotifications();
    const timer = setInterval(() => {
      void pollLikeNotifications();
    }, 90_000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled, getAccessToken, initialized, user]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      enabled,
      pushToken,
      async setEnabled(next) {
        setEnabledState(next);
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, String(next));
        if (!next) {
          await AsyncStorage.removeItem(LIKE_CACHE_KEY);
        }
      },
    }),
    [enabled, pushToken],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
