"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
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

type CreditPackWithMath = (typeof PRICING.credits)[number] & {
  priceValue: number;
  pricePerCredit: number;
};

function parsePriceValue(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseFirstInteger(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatCurrency(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

const FREE_DAILY_CREDITS =
  parseFirstInteger(PRICING.free.features.find((feature) => feature.toLowerCase().includes("daily free credits")) ?? "") ||
  2;

const CREDIT_PACKS: CreditPackWithMath[] = PRICING.credits.map((pack) => {
  const priceValue = parsePriceValue(pack.price);
  return {
    ...pack,
    priceValue,
    pricePerCredit: priceValue / pack.credits,
  };
});

const BEST_VALUE_PACK = CREDIT_PACKS.reduce<CreditPackWithMath | null>((best, pack) => {
  if (!best) return pack;
  return pack.pricePerCredit < best.pricePerCredit ? pack : best;
}, null);

const PRO_MONTHLY_PRICE = parsePriceValue(PRICING.pro.price);
const PRO_DAILY_PRICE = PRO_MONTHLY_PRICE / 30;
const PRO_BREAK_EVEN_CREDITS = BEST_VALUE_PACK ? Math.ceil(PRO_MONTHLY_PRICE / BEST_VALUE_PACK.pricePerCredit) : null;

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10">
      <section className="overflow-hidden rounded-[2.25rem] border border-border/60 bg-[linear-gradient(135deg,rgba(199,102,43,0.12),rgba(255,247,239,0.94)_48%,rgba(255,221,193,0.45))] px-5 py-7 shadow-[0_30px_80px_-48px_rgba(72,42,18,0.42)] sm:px-7 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Pricing</p>
              <h1 className="max-w-3xl font-display text-4xl font-semibold leading-none tracking-[-0.04em] sm:text-5xl">
                Pay only when the first result already feels worth keeping.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Free proves the workflow. Credit packs keep it flexible. Pro removes friction once you are generating
                often enough that clean exports and no ads matter more than the trial.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/generate">
                  Test The Workflow
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/gallery">See Proven Styles</Link>
              </Button>
            </div>

            <div className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
              <p className="text-xs leading-6 text-muted-foreground">
                {isStripeBilling
                  ? "Legacy Stripe mode is enabled in this environment."
                  : "Ads-first mode is active. Razorpay falls back to mock grants when keys are not configured."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Try first",
                value: `${FREE_DAILY_CREDITS} free credits`,
                detail: "Per day, before you spend anything.",
                icon: Sparkles,
              },
              {
                label: "Best pack rate",
                value: BEST_VALUE_PACK ? `${formatCurrency(BEST_VALUE_PACK.pricePerCredit, 2)} / credit` : "Top up anytime",
                detail: BEST_VALUE_PACK ? `${BEST_VALUE_PACK.label} is the cheapest occasional-use option.` : "Buy credits only when you need them.",
                icon: WalletCards,
              },
              {
                label: "Pro break-even",
                value: PRO_BREAK_EVEN_CREDITS ? `~${PRO_BREAK_EVEN_CREDITS} runs / month` : PRICING.pro.price,
                detail: PRO_BREAK_EVEN_CREDITS
                  ? "After that, Pro costs less than the cheapest credit-pack rate."
                  : "Pro is there once frequent use becomes the norm.",
                icon: ShieldCheck,
              },
            ].map((signal) => {
              const Icon = signal.icon;

              return (
                <div key={signal.label} className="rounded-[1.5rem] border border-border/60 bg-background/78 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span>{signal.label}</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-foreground">{signal.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-[1.85rem] border-border/60 bg-card/75 shadow-[0_20px_55px_-42px_rgba(42,29,18,0.42)]">
          <CardHeader className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Best for first runs</p>
            <CardTitle className="font-display text-3xl">{PRICING.free.name}</CardTitle>
            <p className="text-4xl font-semibold tracking-[-0.03em]">{PRICING.free.price}</p>
            <p className="text-sm leading-6 text-muted-foreground">{PRICING.free.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {PRICING.free.features.map((feature) => (
              <p key={feature} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </p>
            ))}
            <div className="rounded-[1.25rem] border border-border/60 bg-background/65 p-4 text-sm leading-6 text-muted-foreground">
              Use Free if you want to test one or two looks, confirm the output style, and only then decide whether the
              product is worth paying for.
            </div>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/generate">Start Free</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.85rem] border-primary/40 bg-primary/10 shadow-[0_24px_60px_-42px_rgba(199,102,43,0.55)]">
          <CardHeader className="space-y-3">
            <p className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Best for frequent creation
            </p>
            <CardTitle className="font-display text-3xl">{PRICING.pro.name}</CardTitle>
            <p className="text-4xl font-semibold tracking-[-0.03em]">{PRICING.pro.price}</p>
            <p className="text-sm leading-6 text-muted-foreground">{PRICING.pro.description}</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(PRO_DAILY_PRICE, 2)} per day if used all month.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {PRICING.pro.features.map((feature) => (
              <p key={feature} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </p>
            ))}
            <div className="rounded-[1.25rem] border border-primary/20 bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              {PRO_BREAK_EVEN_CREDITS
                ? `If you expect roughly ${PRO_BREAK_EVEN_CREDITS} or more generations a month, Pro is already cheaper than sticking to the best-value credit pack.`
                : "Choose Pro once you care more about speed, clean exports, and repeat use than one-off flexibility."}
            </div>
            <Button className="w-full" onClick={() => checkout("pro_monthly")} disabled={loadingPlan === "pro_monthly"}>
              {loadingPlan === "pro_monthly" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Credit Packs</p>
          <h2 className="font-display text-3xl font-semibold leading-none tracking-[-0.03em]">Top up only when you need flexibility.</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Credit packs are the honest choice for occasional use. They make more sense than Pro if you are still
            testing styles or only generate once in a while.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} className="rounded-[1.65rem] border-border/60 bg-card/75">
              <CardHeader className="space-y-3">
                {BEST_VALUE_PACK?.id === pack.id ? (
                  <p className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                    Lowest cost per credit
                  </p>
                ) : null}
                <CardTitle className="font-display text-2xl">{pack.label}</CardTitle>
                <p className="text-3xl font-semibold tracking-[-0.03em]">{pack.price}</p>
                <p className="text-sm leading-6 text-muted-foreground">{formatCurrency(pack.pricePerCredit, 2)} per credit.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.2rem] border border-border/60 bg-background/65 p-4 text-sm leading-6 text-muted-foreground">
                  Good if you want predictable one-off top-ups without committing to a monthly plan.
                </div>
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

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            label: "Use Free",
            title: "Validate the first result",
            description: `Start here if you are still asking whether ${FREE_DAILY_CREDITS} free credits are enough to prove the product is working for your photos.`,
          },
          {
            label: "Use Credits",
            title: "Stay flexible",
            description: BEST_VALUE_PACK
              ? `${BEST_VALUE_PACK.label} gets the cost down to ${formatCurrency(BEST_VALUE_PACK.pricePerCredit, 2)} per credit and keeps you out of a subscription.`
              : "Top up only when you know you need another batch of generations.",
          },
          {
            label: "Use Pro",
            title: "Remove the final friction",
            description: PRO_BREAK_EVEN_CREDITS
              ? `Pick Pro when watermark-free exports matter and you expect around ${PRO_BREAK_EVEN_CREDITS} or more generations in a month.`
              : "Pick Pro when clean exports, no ads, and repeat use matter more than occasional flexibility.",
          },
        ].map((item) => (
          <Card key={item.label} className="rounded-[1.65rem] border-border/60 bg-card/75">
            <CardHeader className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
              <CardTitle className="font-display text-2xl">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
