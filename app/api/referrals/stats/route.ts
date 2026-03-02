import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const [{ data: userRow }, { data: referralRows }] = await Promise.all([
    supabase.from("users").select("referral_code").eq("id", authUser.id).maybeSingle(),
    supabase.from("referrals").select("*").eq("referrer_id", authUser.id).order("created_at", { ascending: false }),
  ]);

  const referredUserIds = Array.from(new Set((referralRows ?? []).map((row) => row.referred_id)));
  const { data: referredUsers } = referredUserIds.length
    ? await supabase.from("users").select("id, email, full_name, created_at").in("id", referredUserIds)
    : { data: [] as Array<{ id: string; email: string; full_name: string | null; created_at: string }> };

  const referredUserMap = new Map((referredUsers ?? []).map((user) => [user.id, user]));

  const referrals = (referralRows ?? []).map((row) => ({
    id: row.id,
    referred_id: row.referred_id,
    reward_credited: row.reward_credited,
    created_at: row.created_at,
    referred_user: referredUserMap.get(row.referred_id) ?? null,
  }));

  const rewarded = referrals.filter((row) => row.reward_credited).length;

  return NextResponse.json({
    referralCode: userRow?.referral_code ?? null,
    referralLink:
      userRow?.referral_code && process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(userRow.referral_code)}`
        : null,
    totalReferrals: referrals.length,
    rewardedReferrals: rewarded,
    pendingReferrals: referrals.length - rewarded,
    referrals,
  });
}
