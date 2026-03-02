import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const billingMode = (process.env.BILLING_MODE ?? process.env.NEXT_PUBLIC_BILLING_MODE ?? "mock").trim().toLowerCase();

function isStripeBillingMode() {
  return billingMode === "stripe";
}

export function getBillingMode() {
  return isStripeBillingMode() ? "stripe" : "mock";
}

export function isStripeConfigured() {
  return isStripeBillingMode() && Boolean(stripeSecretKey);
}

export function isStripeWebhookConfigured() {
  return isStripeBillingMode() && Boolean(stripeSecretKey && stripeWebhookSecret);
}

export const stripe = isStripeBillingMode() && stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    })
  : null;

export const STRIPE_PRICE_TABLE = {
  pro_monthly: {
    mode: "subscription" as const,
    name: "PromptGallery Pro",
    unitAmount: 4900,
    recurring: { interval: "month" as const },
  },
  credits_10: {
    mode: "payment" as const,
    name: "10 Credits Pack",
    unitAmount: 900,
    credits: 10,
  },
  credits_20: {
    mode: "payment" as const,
    name: "20 Credits Pack",
    unitAmount: 1990,
    credits: 20,
  },
  credits_50: {
    mode: "payment" as const,
    name: "50 Credits Pack",
    unitAmount: 3900,
    credits: 50,
  },
  credits_100: {
    mode: "payment" as const,
    name: "100 Credits Pack",
    unitAmount: 6900,
    credits: 100,
  },
};

export { stripeWebhookSecret };
