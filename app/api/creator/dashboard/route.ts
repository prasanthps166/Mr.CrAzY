import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getCreatorDashboardData } from "@/lib/marketplace";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const data = await getCreatorDashboardData(authUser.id);
  if (!data.creator) {
    return NextResponse.json({ message: "Creator profile not found" }, { status: 403 });
  }

  let onboardingStatus = {
    connected: Boolean(data.creator.razorpay_account_id || data.creator.stripe_account_id),
    chargesEnabled: Boolean(data.creator.razorpay_account_id || data.creator.stripe_account_id),
    payoutsEnabled: Boolean(data.creator.razorpay_account_id || data.creator.stripe_account_id),
  };

  return NextResponse.json({
    ...data,
    pendingPayouts: data.stats.totalEarnings,
    onboardingStatus,
  });
}
