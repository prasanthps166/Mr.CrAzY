export const BILLING_PLANS = {
  pro_monthly: {
    type: "pro" as const,
    label: "PromptGallery Pro",
  },
  credits_10: {
    type: "credits" as const,
    label: "10 Credits",
    credits: 10,
  },
  credits_20: {
    type: "credits" as const,
    label: "20 Credits",
    credits: 20,
  },
  credits_50: {
    type: "credits" as const,
    label: "50 Credits",
    credits: 50,
  },
  credits_100: {
    type: "credits" as const,
    label: "100 Credits",
    credits: 100,
  },
};

export type BillingPlanId = keyof typeof BILLING_PLANS;

export function isBillingPlanId(value: string): value is BillingPlanId {
  return value in BILLING_PLANS;
}
