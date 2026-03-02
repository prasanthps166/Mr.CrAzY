"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRICING } from "@/lib/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function ensureRazorpayScriptLoaded() {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout SDK"));
    document.body.appendChild(script);
  });

  return Boolean(window.Razorpay);
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const router = useRouter();
  const handledCheckoutRef = useRef<string | null>(null);
  const billingMode = (process.env.NEXT_PUBLIC_BILLING_MODE ?? "mock").trim().toLowerCase();
  const isStripeBilling = billingMode === "stripe";

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!checkout) return;

    const marker = `${checkout}:${sessionId ?? ""}`;
    if (handledCheckoutRef.current === marker) return;
    handledCheckoutRef.current = marker;

    if (checkout === "success") {
      toast.success("Checkout completed. Applying your purchase...");
      window.dispatchEvent(new Event("credits-updated"));
      router.refresh();
    } else if (checkout === "cancel") {
      toast.message("Checkout canceled.");
    }

    router.replace("/pricing", { scroll: false });
  }, [router]);

  async function checkout(planId: string) {
    if (!supabase) {
      toast.error("Supabase is not configured");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Please login to continue checkout");
      return;
    }

    setLoadingPlan(planId);
    try {
      const response = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        mock?: boolean;
        verified?: boolean;
        credits?: number;
        isPro?: boolean;
        keyId?: string | null;
        order?: {
          id: string;
          amount: number;
          currency: string;
        };
      };
      if (!response.ok) {
        setLoadingPlan(null);
        toast.error(payload.message || "Unable to create order");
        return;
      }

      if (payload.mock || payload.verified) {
        setLoadingPlan(null);
        toast.success(payload.message || "Purchase applied");
        window.dispatchEvent(new Event("credits-updated"));
        router.refresh();
        return;
      }

      if (!payload.order || !payload.keyId) {
        setLoadingPlan(null);
        toast.error("Razorpay order response is incomplete");
        return;
      }

      const scriptReady = await ensureRazorpayScriptLoaded();
      if (!scriptReady || !window.Razorpay) {
        setLoadingPlan(null);
        toast.error("Razorpay checkout SDK not available");
        return;
      }

      const razorpay = new window.Razorpay({
        key: payload.keyId,
        amount: payload.order.amount,
        currency: payload.order.currency,
        name: "PromptGallery",
        description: "Credits and Pro upgrade",
        order_id: payload.order.id,
        handler: async (payment: Record<string, string>) => {
          const verifyResponse = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              plan: planId,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }),
          });

          const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as { message?: string };
          if (!verifyResponse.ok) {
            toast.error(verifyPayload.message || "Payment verification failed");
            return;
          }

          toast.success("Payment successful");
          window.dispatchEvent(new Event("credits-updated"));
          router.refresh();
        },
        prefill: {},
        theme: {
          color: "#c86434",
        },
      });

      razorpay.open();
      setLoadingPlan(null);
    } catch {
      setLoadingPlan(null);
      toast.error("Unable to process order");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-10 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">Choose Pro or top up credits as needed.</p>
        <p className="text-xs text-muted-foreground">
          {isStripeBilling
            ? "Legacy Stripe mode is enabled in this environment."
            : "Ads-first mode is active. Razorpay falls back to mock grants when keys are not configured."}
        </p>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{PRICING.free.name}</CardTitle>
            <p className="text-3xl font-bold">{PRICING.free.price}</p>
            <p className="text-sm text-muted-foreground">{PRICING.free.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRICING.free.features.map((feature) => (
              <p key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/10">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{PRICING.pro.name}</CardTitle>
            <p className="text-3xl font-bold">{PRICING.pro.price}</p>
            <p className="text-sm text-muted-foreground">{PRICING.pro.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRICING.pro.features.map((feature) => (
              <p key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </p>
            ))}
            <Button onClick={() => checkout("pro_monthly")} disabled={loadingPlan === "pro_monthly"}>
              {loadingPlan === "pro_monthly" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Credit Packs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PRICING.credits.map((pack) => (
            <Card key={pack.id} className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="font-display">{pack.label}</CardTitle>
                <p className="text-2xl font-bold">{pack.price}</p>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => checkout(pack.id)}
                  disabled={loadingPlan === pack.id}
                >
                  {loadingPlan === pack.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Buy {pack.label}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
