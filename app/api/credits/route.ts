import { NextRequest, NextResponse } from "next/server";

import { applyDailyLoginBonus, ensureDailyCredits, SIGNUP_STARTER_CREDITS } from "@/lib/credits";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";
import { getUserFromAccessToken } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const authUser = await getUserFromAccessToken(token);

  if (!authUser) {
    const guestUsed = request.cookies.get("guest_generation_used")?.value === "1";
    return NextResponse.json({
      credits: guestUsed ? 0 : 1,
      isPro: false,
      guest: true,
    });
  }

  await ensureUserProfile(authUser);
  const profile = await getUserProfileById(authUser.id);
  if (!profile) {
    return NextResponse.json(
      {
        message: "User profile not found",
        credits: SIGNUP_STARTER_CREDITS,
        isPro: false,
      },
      { status: 200 },
    );
  }

  const refreshed = await ensureDailyCredits(profile);
  const withBonus = await applyDailyLoginBonus(refreshed);
  return NextResponse.json({
    credits: withBonus.credits,
    isPro: withBonus.is_pro,
    dailyCreditsUsed: withBonus.daily_credits_used ?? 0,
    dailyAdCredits: withBonus.daily_ad_credits ?? 0,
    dailyShareCredits: withBonus.daily_share_credits ?? 0,
    guest: false,
  });
}
