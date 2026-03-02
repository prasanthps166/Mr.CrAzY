import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { grantRewardedAdCredits } from "@/lib/credits";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ad_type?: "rewarded_web" | "rewarded_mobile";
    completion_token?: string;
  };

  if (!body.completion_token || body.completion_token.trim().length < 6) {
    return NextResponse.json({ message: "Invalid ad completion token" }, { status: 400 });
  }

  await ensureUserProfile(authUser);
  const profile = await getUserProfileById(authUser.id);
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }
  if (profile.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  const adType = body.ad_type === "rewarded_mobile" ? "rewarded_mobile" : "rewarded_web";
  await trackEvent({
    userId: authUser.id,
    eventType: "ad_watch_start",
    metadata: {
      ad_type: adType,
    },
  });

  const result = await grantRewardedAdCredits(profile, adType);
  if (!result.ok) {
    return NextResponse.json({ message: result.reason }, { status: 400 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "ad_watch_complete",
    metadata: {
      ad_type: adType,
      credits_earned: result.grantedCredits,
    },
  });

  return NextResponse.json({
    ok: true,
    credits: result.user.credits,
    grantedCredits: result.grantedCredits,
    dailyAdCredits: result.user.daily_ad_credits ?? 0,
  });
}
