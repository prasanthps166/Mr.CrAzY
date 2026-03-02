import { NextRequest, NextResponse } from "next/server";

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

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("razorpay_account_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    mock: true,
    onboardingUrl: null,
    connected: Boolean(creatorProfile?.razorpay_account_id),
    message:
      creatorProfile?.razorpay_account_id
        ? "Razorpay account already connected."
        : "Set your Razorpay account ID in creator profile to enable payouts.",
  });
}
