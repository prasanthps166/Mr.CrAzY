import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let notificationHandlerConfigured = false;

export function isValidReminderTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseReminderTime(value: string): { hour: number; minute: number } {
  const [hourText, minuteText] = value.split(":");
  return {
    hour: Number(hourText),
    minute: Number(minuteText)
  };
}

export function configureReminderNotifications() {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });

  notificationHandlerConfigured = true;
}

async function ensurePermission(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("daily-reminders", {
    name: "Daily reminders",
    importance: Notifications.AndroidImportance.DEFAULT
  });
}

export async function cancelReminderById(notificationId: string | null): Promise<void> {
  if (!notificationId) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function scheduleDailyReminder(
  time: string,
  title: string,
  body: string
): Promise<{ ok: true; notificationId: string } | { ok: false; reason: string }> {
  if (!isValidReminderTime(time)) {
    return { ok: false, reason: "Invalid time format" };
  }

  configureReminderNotifications();
  await ensureAndroidChannel();
  const granted = await ensurePermission();

  if (!granted) {
    return { ok: false, reason: "Notification permission denied" };
  }

  const { hour, minute } = parseReminderTime(time);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute
    }
  });

  return {
    ok: true,
    notificationId
  };
}

