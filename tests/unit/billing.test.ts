import { describe, expect, it } from "vitest";

import { BILLING_PLANS, isBillingPlanId } from "@/lib/billing";

describe("billing plan helpers", () => {
  it("accepts valid billing plan ids", () => {
    for (const planId of Object.keys(BILLING_PLANS)) {
      expect(isBillingPlanId(planId)).toBe(true);
    }
  });

  it("rejects unknown billing plan ids", () => {
    expect(isBillingPlanId("credits_999")).toBe(false);
    expect(isBillingPlanId("pro_yearly")).toBe(false);
    expect(isBillingPlanId("")).toBe(false);
  });
});
