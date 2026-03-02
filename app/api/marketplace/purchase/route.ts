import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile } from "@/lib/data";
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

  await ensureUserProfile(authUser);

  const body = (await request.json().catch(() => ({}))) as {
    marketplace_prompt_id?: string;
    payment_method_id?: string;
  };

  if (!body.marketplace_prompt_id) {
    return NextResponse.json({ message: "marketplace_prompt_id is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const [{ data: userRow }, { data: promptRow }] = await Promise.all([
    supabase.from("users").select("id, is_suspended").eq("id", authUser.id).maybeSingle(),
    supabase
      .from("marketplace_prompts")
      .select("id, title, prompt_text, price, price_inr, is_free, status, creator_id")
      .eq("id", body.marketplace_prompt_id)
      .maybeSingle(),
  ]);

  if (!userRow || userRow.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  if (!promptRow || promptRow.status !== "approved") {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("prompt_purchases")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("marketplace_prompt_id", promptRow.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyPurchased: true,
      prompt_text: promptRow.prompt_text,
    });
  }

  const amountPaid =
    promptRow.is_free
      ? 0
      : Number(promptRow.price_inr ?? promptRow.price) || 0;
  let razorpayPaymentId: string | null = null;

  if (!promptRow.is_free && amountPaid > 0) {
    if (isRazorpayConfigured()) {
      // Marketplace Razorpay capture flow is handled client-side via create-order/verify.
      // For now we accept a provided payment_method_id token as a mocked payment reference.
      if (!body.payment_method_id) {
        return NextResponse.json(
          {
            ok: false,
            requiresPaymentMethod: true,
            message: "Razorpay payment reference is required",
          },
          { status: 402 },
        );
      }

      razorpayPaymentId = body.payment_method_id;
    } else {
      razorpayPaymentId = `mock_rzp_${Date.now()}`;
    }
  }

  const creatorEarnings = toMoney(amountPaid * 0.7);
  const platformFee = toMoney(amountPaid - creatorEarnings);

  const { error } = await supabase.from("prompt_purchases").insert({
    user_id: authUser.id,
    marketplace_prompt_id: promptRow.id,
    amount_paid: amountPaid,
    amount_paid_inr: amountPaid,
    creator_earnings: creatorEarnings,
    creator_earnings_inr: creatorEarnings,
    platform_fee: platformFee,
    platform_fee_inr: platformFee,
    razorpay_payment_id: razorpayPaymentId,
    stripe_payment_intent_id: razorpayPaymentId,
  });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({
        ok: true,
        alreadyPurchased: true,
        prompt_text: promptRow.prompt_text,
      });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "marketplace_purchase",
    metadata: {
      marketplace_prompt_id: promptRow.id,
      amount_paid_inr: amountPaid,
      is_free: promptRow.is_free,
    },
  });

  return NextResponse.json({
    ok: true,
    prompt_text: promptRow.prompt_text,
    purchased: true,
    amount_paid: amountPaid,
  });
}
