import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    display_name?: string;
    bio?: string;
    payout_email?: string;
    razorpay_account_id?: string;
  };

  const displayName = body.display_name?.trim();
  if (!displayName) {
    return NextResponse.json({ message: "display_name is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: profileRow } = await supabase
    .from("users")
    .select("avatar_url, is_suspended")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profileRow || profileRow.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  const { data: existingCreator } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  const stripeAccountId = existingCreator?.stripe_account_id ?? null;
  const razorpayAccountId = body.razorpay_account_id?.trim() || existingCreator?.razorpay_account_id || null;

  const payload = {
    user_id: authUser.id,
    display_name: displayName,
    bio: body.bio?.trim() || null,
    payout_email: body.payout_email?.trim() || null,
    avatar_url: existingCreator?.avatar_url ?? profileRow.avatar_url ?? null,
    stripe_account_id: stripeAccountId,
    razorpay_account_id: razorpayAccountId,
  };

  const { data: creatorProfile, error } = await supabase
    .from("creator_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !creatorProfile) {
    return NextResponse.json({ message: error?.message || "Failed to create creator profile" }, { status: 500 });
  }

  const onboardingUrl: string | null = null;

  return NextResponse.json({
    ok: true,
    creatorProfile,
    onboardingUrl,
  });
}
