import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== "granted") {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

export async function notifyGenerationComplete(promptTitle: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Generation Complete",
      body: `${promptTitle} is ready. Open PromptGallery to view your result.`,
      sound: false,
    },
    trigger: null,
  });
}

export async function notifyCommunityLike(postTitle: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New Like",
      body: `Someone liked your community post: ${postTitle}`,
      sound: false,
    },
    trigger: null,
  });
}

const WEEKLY_NOTIFICATION_ID = "promptgallery-weekly-prompts";
const DAILY_CREDITS_NOTIFICATION_ID = "promptgallery-daily-credits";

export async function ensureWeeklyPromptsNotification() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const exists = scheduled.some((item) => item.identifier === WEEKLY_NOTIFICATION_ID);
  if (exists) return;

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_NOTIFICATION_ID,
    content: {
      title: "New Prompts Added",
      body: "Fresh styles are now live. Discover this week's additions in PromptGallery.",
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 1,
      hour: 10,
      minute: 0,
      repeats: true,
    },
  });
}

export async function ensureDailyCreditsNotification() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const exists = scheduled.some((item) => item.identifier === DAILY_CREDITS_NOTIFICATION_ID);
  if (exists) return;

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_CREDITS_NOTIFICATION_ID,
    content: {
      title: "Your free credits are ready",
      body: "Your 2 free credits are ready. Open PromptGallery and create now.",
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

export async function disableWeeklyPromptsNotification() {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_NOTIFICATION_ID);
}

export async function disableDailyCreditsNotification() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_CREDITS_NOTIFICATION_ID);
}
