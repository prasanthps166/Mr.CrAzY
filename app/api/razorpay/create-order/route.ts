import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";
import { createRazorpayOrder, getRazorpayPublicConfig, isRazorpayConfigured } from "@/lib/razorpay";
import { createServiceRoleClient } from "@/lib/supabase";

type PlanId = "pro_monthly" | "credits_10" | "credits_50" | "credits_100";

const PLAN_TABLE: Record<
  PlanId,
  {
    amountInPaise: number;
    credits: number;
    type: "pro" | "credits";
  }
> = {
  pro_monthly: { amountInPaise: 4900, credits: 0, type: "pro" },
  credits_10: { amountInPaise: 900, credits: 10, type: "credits" },
  credits_50: { amountInPaise: 3900, credits: 50, type: "credits" },
  credits_100: { amountInPaise: 6900, credits: 100, type: "credits" },
};

function isPlanId(value: string): value is PlanId {
  return value in PLAN_TABLE;
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  if (!body.plan || !isPlanId(body.plan)) {
    return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
  }

  const profile = (await ensureUserProfile(authUser)) ?? (await getUserProfileById(authUser.id));
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }
  if (profile.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  const selected = PLAN_TABLE[body.plan];
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  if (!isRazorpayConfigured()) {
    const nextCredits = selected.type === "credits" ? Number(profile.credits || 0) + selected.credits : Number(profile.credits || 0);
    const nextIsPro = selected.type === "pro" ? true : Boolean(profile.is_pro);

    const { error } = await supabase
      .from("users")
      .update({
        credits: nextCredits,
        is_pro: nextIsPro,
      })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    await trackEvent({
      userId: profile.id,
      eventType: selected.type === "pro" ? "pro_upgrade" : "purchase",
      metadata: {
        provider: "razorpay_mock",
        plan: body.plan,
        amount_inr: selected.amountInPaise / 100,
      },
    });

    return NextResponse.json({
      ok: true,
      mock: true,
      verified: true,
      plan: body.plan,
      credits: nextCredits,
      isPro: nextIsPro,
      message:
        selected.type === "pro"
          ? "Mock Pro upgrade applied."
          : `Mock purchase complete. Added ${selected.credits} credits.`,
    });
  }

  try {
    const order = await createRazorpayOrder({
      amountInPaise: selected.amountInPaise,
      currency: "INR",
      receipt: `pg_${body.plan}_${Date.now()}`,
      notes: {
        user_id: authUser.id,
        plan: body.plan,
      },
    });

    return NextResponse.json({
      ok: true,
      mock: false,
      provider: "razorpay",
      order,
      keyId: getRazorpayPublicConfig().keyId,
      plan: body.plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Razorpay order";
    return NextResponse.json({ message }, { status: 500 });
  }
}
