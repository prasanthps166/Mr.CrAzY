import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { grantWhatsAppShareCredits } from "@/lib/credits";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    channel?: "whatsapp" | "instagram";
    generation_id?: string;
  };

  const channel = body.channel === "instagram" ? "instagram" : "whatsapp";

  await ensureUserProfile(authUser);
  const profile = await getUserProfileById(authUser.id);
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }
  if (profile.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  if (channel !== "whatsapp") {
    await trackEvent({
      userId: authUser.id,
      eventType: "share_instagram",
      metadata: {
        generation_id: body.generation_id ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      credits: profile.credits,
      grantedCredits: 0,
      message: "Instagram share tracked",
    });
  }

  const result = await grantWhatsAppShareCredits(profile);
  if (!result.ok) {
    return NextResponse.json({ message: result.reason }, { status: 400 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "share_whatsapp",
    metadata: {
      generation_id: body.generation_id ?? null,
      credits_earned: result.grantedCredits,
    },
  });

  return NextResponse.json({
    ok: true,
    credits: result.user.credits,
    grantedCredits: result.grantedCredits,
    dailyShareCredits: result.user.daily_share_credits ?? 0,
  });
}
