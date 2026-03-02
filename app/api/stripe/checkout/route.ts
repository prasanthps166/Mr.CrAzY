import { NextRequest, NextResponse } from "next/server";

import { syncStripeCustomerForUser } from "@/lib/billing-service";
import { ensureUserProfile, getUserProfileById } from "@/lib/data";
import { BILLING_PLANS, isBillingPlanId } from "@/lib/billing";
import { createServiceRoleClient, getUserFromAccessToken } from "@/lib/supabase";
import { isStripeWebhookConfigured, stripe, STRIPE_PRICE_TABLE } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const authUser = await getUserFromAccessToken(token);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile(authUser);
  const profile = await getUserProfileById(authUser.id);
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }
  if (profile.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  const { plan } = (await request.json().catch(() => ({}))) as {
    plan?: string;
  };
  if (!plan || !isBillingPlanId(plan)) {
    return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const selectedPlan = BILLING_PLANS[plan];

  if (isStripeWebhookConfigured() && stripe) {
    const stripePlan = STRIPE_PRICE_TABLE[plan];

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authUser.email ?? undefined,
        metadata: {
          user_id: authUser.id,
        },
      });
      customerId = customer.id;
      await syncStripeCustomerForUser(authUser.id, customerId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: stripePlan.mode,
      customer: customerId,
      client_reference_id: authUser.id,
      allow_promotion_codes: true,
      success_url: `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: stripePlan.unitAmount,
            product_data: {
              name: stripePlan.name,
            },
            ...(stripePlan.mode === "subscription" ? { recurring: stripePlan.recurring } : {}),
          },
        },
      ],
      metadata: {
        user_id: authUser.id,
        plan_id: plan,
      },
      ...(stripePlan.mode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                user_id: authUser.id,
                plan_id: plan,
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                user_id: authUser.id,
                plan_id: plan,
              },
            },
          }),
    });

    if (!session.url) {
      return NextResponse.json({ message: "Failed to create Stripe checkout session" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      provider: "stripe",
      checkoutUrl: session.url,
    });
  }

  const nextCredits =
    selectedPlan.type === "credits" ? Math.max(0, Number(profile.credits) || 0) + selectedPlan.credits : Number(profile.credits) || 0;
  const nextIsPro = selectedPlan.type === "pro" ? true : Boolean(profile.is_pro);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      credits: nextCredits,
      is_pro: nextIsPro,
    })
    .eq("id", authUser.id);

  if (updateError) {
    return NextResponse.json({ message: updateError.message || "Failed to apply purchase" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mock: true,
    message:
      selectedPlan.type === "pro"
        ? "Mock upgrade applied. Your account is now Pro."
        : `Mock purchase complete. Added ${selectedPlan.credits} credits.`,
    credits: nextCredits,
    isPro: nextIsPro,
  });
}
