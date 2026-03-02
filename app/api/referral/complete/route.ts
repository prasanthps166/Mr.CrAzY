import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_id, reward_credited")
    .eq("referred_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!referral) {
    return NextResponse.json({ ok: true, rewarded: false, message: "No active referral found" });
  }

  if (referral.reward_credited) {
    return NextResponse.json({ ok: true, rewarded: false, message: "Referral reward already credited" });
  }

  const [{ data: referrer }, updateRewardResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, credits")
      .eq("id", referral.referrer_id)
      .maybeSingle(),
    supabase.from("referrals").update({ reward_credited: true }).eq("id", referral.id),
  ]);

  if (!referrer) {
    return NextResponse.json({ message: "Referrer not found" }, { status: 404 });
  }
  if (updateRewardResult.error) {
    return NextResponse.json({ message: updateRewardResult.error.message }, { status: 500 });
  }

  const rewardCredits = 5;
  const { error: creditError } = await supabase
    .from("users")
    .update({
      credits: Number(referrer.credits ?? 0) + rewardCredits,
    })
    .eq("id", referrer.id);

  if (creditError) {
    return NextResponse.json({ message: creditError.message }, { status: 500 });
  }

  await trackEvent({
    userId: referrer.id,
    eventType: "referral_complete",
    metadata: {
      referred_id: authUser.id,
      credits_earned: rewardCredits,
    },
  });

  return NextResponse.json({
    ok: true,
    rewarded: true,
    creditsEarned: rewardCredits,
  });
}
