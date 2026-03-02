import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import {
  applyBillingGrant,
  findUserIdByStripeCustomerId,
  revokeProAccessBySubscription,
  syncStripeCustomerForUser,
  syncStripeSubscriptionForUser,
} from "@/lib/billing-service";
import { BillingPlanId, isBillingPlanId } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase";
import { isStripeWebhookConfigured, stripe, stripeWebhookSecret } from "@/lib/stripe";

function asText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function asStripeObjectId(value: unknown) {
  const text = asText(value);
  if (text) return text;

  if (value && typeof value === "object" && "id" in value) {
    const maybeId = (value as { id?: unknown }).id;
    return asText(maybeId);
  }

  return null;
}

async function resolveUserId(metadataUserId: string | null, stripeCustomerId: string | null) {
  if (metadataUserId) return metadataUserId;
  if (!stripeCustomerId) return null;
  return findUserIdByStripeCustomerId(stripeCustomerId);
}

function resolvePlanId(planId: string | null, fallbackToPro = false) {
  if (planId && isBillingPlanId(planId)) return planId;
  return fallbackToPro ? "pro_monthly" : null;
}

async function handleCheckoutSessionCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const metadataUserId = asText(session.metadata?.user_id);
  const metadataPlanId = asText(session.metadata?.plan_id);
  const stripeCustomerId = asStripeObjectId(session.customer);
  const stripePaymentIntentId = asStripeObjectId(session.payment_intent);
  const stripeSubscriptionId = asStripeObjectId(session.subscription);
  const userId = await resolveUserId(metadataUserId, stripeCustomerId);

  if (!userId) return;
  if (stripeCustomerId) {
    await syncStripeCustomerForUser(userId, stripeCustomerId);
  }

  if (session.mode === "subscription") {
    await syncStripeSubscriptionForUser(userId, stripeSubscriptionId);
    return;
  }

  const planId = resolvePlanId(metadataPlanId, false);
  if (!planId) return;

  await applyBillingGrant({
    userId,
    planId,
    amountTotal: (session.amount_total ?? 0) / 100,
    currency: session.currency ?? "usd",
    stripeCustomerId,
    stripeSubscriptionId,
    stripeEventId: event.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    metadata: {
      source: "stripe_checkout_session_completed",
      mode: session.mode,
      payment_status: session.payment_status,
    },
  });
}

async function handleInvoicePaid(event: Stripe.Event, invoice: Stripe.Invoice) {
  const stripeSubscriptionId = asStripeObjectId(invoice.parent?.subscription_details?.subscription);
  if (!stripeSubscriptionId) return;

  const stripeCustomerId = asStripeObjectId(invoice.customer);
  const metadataUserId = asText(invoice.metadata?.user_id);
  const metadataPlanId = asText(invoice.metadata?.plan_id);
  const parentPlanId = asText(invoice.parent?.subscription_details?.metadata?.plan_id);
  const userId = await resolveUserId(metadataUserId, stripeCustomerId);
  if (!userId) return;

  const linePlanId = invoice.lines.data
    .map((line) => asText(line.metadata?.plan_id))
    .find((candidate): candidate is BillingPlanId => Boolean(candidate && isBillingPlanId(candidate)));

  const planId = resolvePlanId(metadataPlanId ?? parentPlanId ?? linePlanId ?? null, true);
  if (!planId) return;

  await syncStripeCustomerForUser(userId, stripeCustomerId);
  await syncStripeSubscriptionForUser(userId, stripeSubscriptionId);

  await applyBillingGrant({
    userId,
    planId,
    amountTotal: (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100,
    currency: invoice.currency ?? "usd",
    stripeCustomerId,
    stripeSubscriptionId,
    stripeEventId: event.id,
    stripeInvoiceId: invoice.id,
    metadata: {
      source: "stripe_invoice_paid",
      billing_reason: invoice.billing_reason ?? null,
      status: invoice.status ?? null,
    },
  });
}

async function handleSubscriptionCanceled(event: Stripe.Event, subscription: Stripe.Subscription) {
  const stripeSubscriptionId = asText(subscription.id);
  const stripeCustomerId = asStripeObjectId(subscription.customer);
  const userId = await revokeProAccessBySubscription(stripeSubscriptionId, stripeCustomerId);
  if (!userId) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const { error } = await supabase.from("billing_transactions").insert({
    user_id: userId,
    plan_id: "pro_monthly",
    kind: "subscription",
    status: "canceled",
    amount_total: 0,
    currency: "usd",
    stripe_event_id: event.id,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    metadata: {
      source: "stripe_subscription_canceled",
      subscription_status: subscription.status,
    },
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = asText(subscription.id);
  const stripeCustomerId = asStripeObjectId(subscription.customer);
  const userId = await resolveUserId(null, stripeCustomerId);
  if (!userId) return;

  if (["active", "trialing", "past_due"].includes(subscription.status)) {
    await syncStripeCustomerForUser(userId, stripeCustomerId);
    await syncStripeSubscriptionForUser(userId, stripeSubscriptionId);
    return;
  }

  if (["canceled", "incomplete_expired", "unpaid"].includes(subscription.status)) {
    await revokeProAccessBySubscription(stripeSubscriptionId, stripeCustomerId);
  }
}

export async function POST(request: NextRequest) {
  if (!isStripeWebhookConfigured() || !stripe || !stripeWebhookSecret) {
    return NextResponse.json(
      {
        ok: true,
        mock: true,
        message: "Stripe webhook is disabled in mock billing mode.",
      },
      { status: 200 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(event, event.data.object as Stripe.Invoice);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionCanceled(event, event.data.object as Stripe.Subscription);
    } else if (event.type === "customer.subscription.updated") {
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handling failed";
    return NextResponse.json({ message }, { status: 500 });
  }

  return NextResponse.json({ received: true, eventType: event.type }, { status: 200 });
}
