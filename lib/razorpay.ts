import crypto from "node:crypto";

const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim();
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

export function isRazorpayConfigured() {
  return Boolean(razorpayKeyId && razorpayKeySecret);
}

export function getRazorpayPublicConfig() {
  return {
    keyId: razorpayKeyId ?? null,
  };
}

type CreateRazorpayOrderInput = {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
};

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status?: string;
};

export async function createRazorpayOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrderResponse> {
  if (!isRazorpayConfigured() || !razorpayKeyId || !razorpayKeySecret) {
    return {
      id: `mock_order_${Date.now()}`,
      amount: input.amountInPaise,
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      status: "created",
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(input.amountInPaise),
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as RazorpayOrderResponse & { error?: { description?: string } };
  if (!response.ok || !payload?.id) {
    const reason = payload.error?.description || "Failed to create Razorpay order";
    throw new Error(reason);
  }

  return payload;
}

export function verifyRazorpayPaymentSignature(options: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!razorpayKeySecret) return false;
  const body = `${options.orderId}|${options.paymentId}`;
  const expected = crypto.createHmac("sha256", razorpayKeySecret).update(body).digest("hex");
  return expected === options.signature;
}
