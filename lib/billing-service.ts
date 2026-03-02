import { trackEvent } from "@/lib/analytics";
import { BILLING_PLANS, BillingPlanId, isBillingPlanId } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase";

type BillingTransactionStatus = "pending" | "succeeded" | "failed" | "refunded" | "canceled";
type BillingTransactionKind = "subscription" | "credits" | "marketplace" | "other";

type BillingTransactionRow = {
  id: string;
  status: BillingTransactionStatus;
  stripe_event_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
};

type UserBillingRow = {
  id: string;
  credits: number;
  is_pro: boolean;
};

type DedupeKeys = {
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
};

export type ApplyBillingGrantInput = {
  userId: string;
  planId: BillingPlanId;
  amountTotal: number;
  currency?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ApplyBillingGrantResult = {
  ok: boolean;
  alreadyApplied: boolean;
  message?: string;
  credits?: number;
  isPro?: boolean;
  billingTransactionId?: string;
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeCurrency(value?: string | null) {
  const fallback = "usd";
  if (!value) return fallback;
  return value.trim().toLowerCase() || fallback;
}

function billingKindForPlan(planId: BillingPlanId): BillingTransactionKind {
  return BILLING_PLANS[planId].type === "pro" ? "subscription" : "credits";
}

function normalizeText(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function findBillingTransactionByDedupeKeys(keys: DedupeKeys) {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const candidates: Array<{ column: keyof DedupeKeys; value: string | null | undefined }> = [
    { column: "stripeEventId", value: keys.stripeEventId },
    { column: "stripeCheckoutSessionId", value: keys.stripeCheckoutSessionId },
    { column: "stripePaymentIntentId", value: keys.stripePaymentIntentId },
    { column: "stripeInvoiceId", value: keys.stripeInvoiceId },
  ];

  for (const candidate of candidates) {
    const value = normalizeText(candidate.value);
    if (!value) continue;

    const columnMap: Record<keyof DedupeKeys, keyof BillingTransactionRow> = {
      stripeEventId: "stripe_event_id",
      stripeCheckoutSessionId: "stripe_checkout_session_id",
      stripePaymentIntentId: "stripe_payment_intent_id",
      stripeInvoiceId: "stripe_invoice_id",
    };

    const dbColumn = columnMap[candidate.column];
    const { data } = await supabase
      .from("billing_transactions")
      .select("id, status, stripe_event_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_invoice_id")
      .eq(dbColumn, value)
      .maybeSingle();

    if (data) {
      return data as BillingTransactionRow;
    }
  }

  return null;
}

async function insertPendingTransaction(input: {
  userId: string;
  planId: BillingPlanId;
  kind: BillingTransactionKind;
  amountTotal: number;
  currency: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeEventId: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = createServiceRoleClient();
  if (!supabase) return { id: null, errorMessage: "Supabase service role key is missing" };

  const { data, error } = await supabase
    .from("billing_transactions")
    .insert({
      user_id: input.userId,
      plan_id: input.planId,
      kind: input.kind,
      status: "pending",
      amount_total: toMoney(input.amountTotal),
      currency: normalizeCurrency(input.currency),
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_event_id: input.stripeEventId,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_invoice_id: input.stripeInvoiceId,
      metadata: input.metadata,
    })
    .select("id")
    .single();

  if (error) {
    return {
      id: null,
      errorMessage: error.message,
    };
  }

  return { id: String((data as { id: string }).id), errorMessage: null as string | null };
}

async function updateTransactionStatus(
  transactionId: string,
  status: BillingTransactionStatus,
  metadata?: Record<string, unknown>,
) {
  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const payload: Record<string, unknown> = { status };
  if (metadata) payload.metadata = metadata;

  await supabase.from("billing_transactions").update(payload).eq("id", transactionId);
}

export async function findUserIdByStripeCustomerId(stripeCustomerId: string) {
  const normalized = normalizeText(stripeCustomerId);
  if (!normalized) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", normalized)
    .maybeSingle();

  return data ? String((data as { id: string }).id) : null;
}

export async function syncStripeCustomerForUser(userId: string, stripeCustomerId?: string | null) {
  const normalizedCustomerId = normalizeText(stripeCustomerId);
  if (!normalizedCustomerId) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  await supabase.from("users").update({ stripe_customer_id: normalizedCustomerId }).eq("id", userId);
}

export async function syncStripeSubscriptionForUser(userId: string, stripeSubscriptionId?: string | null) {
  const normalizedSubscriptionId = normalizeText(stripeSubscriptionId);
  if (!normalizedSubscriptionId) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  await supabase
    .from("users")
    .update({ stripe_subscription_id: normalizedSubscriptionId, is_pro: true })
    .eq("id", userId);
}

export async function revokeProAccessBySubscription(stripeSubscriptionId?: string | null, stripeCustomerId?: string | null) {
  const normalizedSubscriptionId = normalizeText(stripeSubscriptionId);
  const normalizedCustomerId = normalizeText(stripeCustomerId);
  if (!normalizedSubscriptionId && !normalizedCustomerId) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  let userId: string | null = null;
  if (normalizedSubscriptionId) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_subscription_id", normalizedSubscriptionId)
      .maybeSingle();
    userId = data ? String((data as { id: string }).id) : null;
  }

  if (!userId && normalizedCustomerId) {
    userId = await findUserIdByStripeCustomerId(normalizedCustomerId);
  }

  if (!userId) return null;

  await supabase
    .from("users")
    .update({
      is_pro: false,
      stripe_subscription_id: null,
    })
    .eq("id", userId);

  return userId;
}

export async function applyBillingGrant(input: ApplyBillingGrantInput): Promise<ApplyBillingGrantResult> {
  if (!isBillingPlanId(input.planId)) {
    return { ok: false, alreadyApplied: false, message: "Invalid billing plan" };
  }

  const normalized = {
    stripeCustomerId: normalizeText(input.stripeCustomerId),
    stripeSubscriptionId: normalizeText(input.stripeSubscriptionId),
    stripeEventId: normalizeText(input.stripeEventId),
    stripeCheckoutSessionId: normalizeText(input.stripeCheckoutSessionId),
    stripePaymentIntentId: normalizeText(input.stripePaymentIntentId),
    stripeInvoiceId: normalizeText(input.stripeInvoiceId),
  };

  const existing = await findBillingTransactionByDedupeKeys(normalized);
  if (existing && existing.status === "succeeded") {
    return { ok: true, alreadyApplied: true, billingTransactionId: existing.id };
  }

  const kind = billingKindForPlan(input.planId);
  const amountTotal = Math.max(0, Number(input.amountTotal || 0));
  const metadata = input.metadata ?? {};

  let insertErrorMessage: string | null = null;
  let transactionId = existing?.id ?? null;

  if (!transactionId) {
    const insertAttempt = await insertPendingTransaction({
      userId: input.userId,
      planId: input.planId,
      kind,
      amountTotal,
      currency: normalizeCurrency(input.currency),
      stripeCustomerId: normalized.stripeCustomerId,
      stripeSubscriptionId: normalized.stripeSubscriptionId,
      stripeEventId: normalized.stripeEventId,
      stripeCheckoutSessionId: normalized.stripeCheckoutSessionId,
      stripePaymentIntentId: normalized.stripePaymentIntentId,
      stripeInvoiceId: normalized.stripeInvoiceId,
      metadata,
    });

    transactionId = insertAttempt.id;
    insertErrorMessage = insertAttempt.errorMessage;
  }

  if (!transactionId) {
    const recheck = await findBillingTransactionByDedupeKeys(normalized);
    if (recheck?.status === "succeeded") {
      return { ok: true, alreadyApplied: true, billingTransactionId: recheck.id };
    }
    if (recheck?.status === "pending") {
      transactionId = recheck.id;
    } else {
      return {
        ok: false,
        alreadyApplied: false,
        message: insertErrorMessage ?? "Failed to insert billing transaction",
      };
    }
  }
  if (!transactionId) {
    return {
      ok: false,
      alreadyApplied: false,
      message: "Failed to resolve billing transaction",
    };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    await updateTransactionStatus(transactionId, "failed", {
      ...metadata,
      error: "Supabase service role key is missing",
    });
    return { ok: false, alreadyApplied: false, message: "Supabase service role key is missing" };
  }

  const { data: userData } = await supabase
    .from("users")
    .select("id, credits, is_pro")
    .eq("id", input.userId)
    .maybeSingle();

  if (!userData) {
    await updateTransactionStatus(transactionId, "failed", {
      ...metadata,
      error: "User not found",
    });
    return { ok: false, alreadyApplied: false, message: "User profile not found" };
  }

  const user = userData as UserBillingRow;
  const plan = BILLING_PLANS[input.planId];

  const nextCredits = plan.type === "credits" ? (Number(user.credits) || 0) + plan.credits : Number(user.credits) || 0;
  const nextIsPro = plan.type === "pro" ? true : Boolean(user.is_pro);

  const updatePayload: Record<string, unknown> = {
    credits: nextCredits,
    is_pro: nextIsPro,
  };
  if (normalized.stripeCustomerId) {
    updatePayload.stripe_customer_id = normalized.stripeCustomerId;
  }
  if (plan.type === "pro" && normalized.stripeSubscriptionId) {
    updatePayload.stripe_subscription_id = normalized.stripeSubscriptionId;
  }

  const { error: updateError } = await supabase.from("users").update(updatePayload).eq("id", input.userId);
  if (updateError) {
    await updateTransactionStatus(transactionId, "failed", {
      ...metadata,
      error: updateError.message,
    });
    return { ok: false, alreadyApplied: false, message: updateError.message };
  }

  await updateTransactionStatus(transactionId, "succeeded", metadata);

  await trackEvent({
    userId: input.userId,
    eventType: "billing_purchase",
    metadata: {
      plan_id: input.planId,
      amount_total: toMoney(amountTotal),
      currency: normalizeCurrency(input.currency),
      transaction_id: transactionId,
      kind,
    },
  });

  return {
    ok: true,
    alreadyApplied: false,
    credits: nextCredits,
    isPro: nextIsPro,
    billingTransactionId: transactionId,
  };
}
