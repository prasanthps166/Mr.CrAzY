import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { trackEvent } from "@/lib/analytics";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { createServiceRoleClient } from "@/lib/supabase";

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
  };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("id, total_earnings, razorpay_account_id, stripe_account_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!creatorProfile) {
    return NextResponse.json({ message: "Creator profile not found" }, { status: 403 });
  }

  const available = Number(creatorProfile.total_earnings) || 0;
  if (available < 500) {
    return NextResponse.json({ message: "Minimum payout amount is ₹500" }, { status: 400 });
  }

  const requestedAmount = Number(body.amount ?? available);
  if (Number.isNaN(requestedAmount) || requestedAmount <= 0) {
    return NextResponse.json({ message: "Invalid payout amount" }, { status: 400 });
  }

  const payoutAmount = toMoney(Math.min(requestedAmount, available));
  if (payoutAmount < 500) {
    return NextResponse.json({ message: "Minimum payout amount is ₹500" }, { status: 400 });
  }

  let transferId: string | null = null;

  if (isRazorpayConfigured()) {
    if (!creatorProfile.razorpay_account_id && !creatorProfile.stripe_account_id) {
      return NextResponse.json(
        { message: "Razorpay account is required before requesting payouts" },
        { status: 400 },
      );
    }

    transferId = `rzp_payout_${Date.now()}`;
  } else {
    transferId = `mock_rzp_payout_${Date.now()}`;
  }

  const nextTotal = toMoney(Math.max(0, available - payoutAmount));
  const { error } = await supabase
    .from("creator_profiles")
    .update({ total_earnings: nextTotal })
    .eq("id", creatorProfile.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "payout_request",
    metadata: {
      amount: payoutAmount,
      transfer_id: transferId,
    },
  });

  return NextResponse.json({
    ok: true,
    transferId,
    amount: payoutAmount,
    remainingBalance: nextTotal,
  });
}
