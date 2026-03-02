import { createServiceRoleClient } from "@/lib/supabase";
import { UserProfile } from "@/types";

export const SIGNUP_STARTER_CREDITS = 3;
export const DAILY_FREE_CREDITS = 2;
export const DAILY_LOGIN_BONUS_CREDITS = 1;
export const REWARDED_AD_CREDITS = 2;
export const MAX_DAILY_AD_CREDITS = 10;
export const WHATSAPP_SHARE_CREDITS = 1;
export const MAX_DAILY_SHARE_CREDITS = 3;

const IST_OFFSET_MINUTES = 330;

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIstDayStart(date = new Date()) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const istMs = utcMs + IST_OFFSET_MINUTES * 60_000;
  const istDate = new Date(istMs);
  const istMidnightUtcMs =
    Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()) - IST_OFFSET_MINUTES * 60_000;
  return new Date(istMidnightUtcMs);
}

export function isBeforeCurrentIstDay(timestamp: string | null | undefined) {
  if (!timestamp) return true;
  return new Date(timestamp) < getIstDayStart();
}

export async function ensureDailyCredits(user: UserProfile) {
  if (user.is_pro) return user;
  const lastReset = user.daily_reset_at ?? user.credits_reset_at;
  if (!isBeforeCurrentIstDay(lastReset)) return user;

  const supabase = createServiceRoleClient();
  if (!supabase) return user;

  const nextCredits = Math.max(0, toNumber(user.credits)) + DAILY_FREE_CREDITS;
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from("users")
    .update({
      credits: nextCredits,
      daily_reset_at: nowIso,
      credits_reset_at: nowIso,
      daily_credits_used: 0,
      daily_ad_credits: 0,
      daily_share_credits: 0,
    })
    .eq("id", user.id)
    .select("*")
    .single();

  return (data as UserProfile) ?? user;
}

export async function applyDailyLoginBonus(user: UserProfile) {
  if (user.is_pro) return user;

  const refreshed = await ensureDailyCredits(user);
  if (!isBeforeCurrentIstDay(refreshed.login_bonus_at)) {
    return refreshed;
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return refreshed;

  const { data } = await supabase
    .from("users")
    .update({
      credits: Math.max(0, toNumber(refreshed.credits)) + DAILY_LOGIN_BONUS_CREDITS,
      login_bonus_at: new Date().toISOString(),
    })
    .eq("id", refreshed.id)
    .select("*")
    .single();

  return (data as UserProfile) ?? refreshed;
}

export async function consumeCredit(user: UserProfile) {
  if (user.is_pro) {
    return { ok: true as const, user };
  }

  const refreshed = await ensureDailyCredits(user);
  if (toNumber(refreshed.credits) <= 0) {
    return { ok: false as const, user: refreshed, reason: "No credits left" };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false as const, user: refreshed, reason: "Server missing Supabase service key" };
  }

  const { data } = await supabase
    .from("users")
    .update({
      credits: Math.max(0, toNumber(refreshed.credits) - 1),
      daily_credits_used: Math.max(0, toNumber(refreshed.daily_credits_used)) + 1,
    })
    .eq("id", refreshed.id)
    .select("*")
    .single();

  return { ok: true as const, user: (data as UserProfile) ?? refreshed };
}

export async function grantRewardedAdCredits(user: UserProfile, adType: "rewarded_web" | "rewarded_mobile" = "rewarded_web") {
  if (user.is_pro) {
    return { ok: false as const, user, reason: "Pro users do not need rewarded credits" };
  }

  const refreshed = await ensureDailyCredits(user);
  const earnedToday = Math.max(0, toNumber(refreshed.daily_ad_credits));
  const remaining = MAX_DAILY_AD_CREDITS - earnedToday;
  if (remaining <= 0) {
    return { ok: false as const, user: refreshed, reason: "Daily rewarded ad limit reached" };
  }

  const grant = Math.min(REWARDED_AD_CREDITS, remaining);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false as const, user: refreshed, reason: "Server missing Supabase service key" };
  }

  const { data } = await supabase
    .from("users")
    .update({
      credits: Math.max(0, toNumber(refreshed.credits)) + grant,
      daily_ad_credits: earnedToday + grant,
    })
    .eq("id", refreshed.id)
    .select("*")
    .single();

  const nextUser = (data as UserProfile) ?? refreshed;
  await supabase.from("ad_watches").insert({
    user_id: refreshed.id,
    ad_type: adType,
    credits_earned: grant,
  });

  return { ok: true as const, user: nextUser, grantedCredits: grant };
}

export async function grantWhatsAppShareCredits(user: UserProfile) {
  if (user.is_pro) {
    return { ok: false as const, user, reason: "Pro users do not need share credits" };
  }

  const refreshed = await ensureDailyCredits(user);
  const earnedToday = Math.max(0, toNumber(refreshed.daily_share_credits));
  if (earnedToday >= MAX_DAILY_SHARE_CREDITS) {
    return { ok: false as const, user: refreshed, reason: "Daily WhatsApp share credit limit reached" };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false as const, user: refreshed, reason: "Server missing Supabase service key" };
  }

  const { data } = await supabase
    .from("users")
    .update({
      credits: Math.max(0, toNumber(refreshed.credits)) + WHATSAPP_SHARE_CREDITS,
      daily_share_credits: earnedToday + WHATSAPP_SHARE_CREDITS,
    })
    .eq("id", refreshed.id)
    .select("*")
    .single();

  return { ok: true as const, user: (data as UserProfile) ?? refreshed, grantedCredits: WHATSAPP_SHARE_CREDITS };
}
