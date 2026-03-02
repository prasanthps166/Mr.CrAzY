import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";
import { isRazorpayConfigured, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
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

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!body.plan || !isPlanId(body.plan)) {
    return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
  }

  await ensureUserProfile(authUser);
  const profile = await getUserProfileById(authUser.id);
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      ok: true,
      mock: true,
      verified: true,
      message: "Razorpay not configured. Use mock create-order flow.",
    });
  }

  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return NextResponse.json({ message: "Missing Razorpay verification fields" }, { status: 400 });
  }

  const signatureOk = verifyRazorpayPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (!signatureOk) {
    return NextResponse.json({ message: "Invalid Razorpay signature" }, { status: 400 });
  }

  const selected = PLAN_TABLE[body.plan];
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
      provider: "razorpay",
      plan: body.plan,
      amount_inr: selected.amountInPaise / 100,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
    },
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    credits: nextCredits,
    isPro: nextIsPro,
  });
}
