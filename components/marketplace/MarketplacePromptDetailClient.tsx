"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Loader2, ShoppingCart, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptCard } from "@/components/marketplace/MarketplacePromptCard";
import { RatingStars } from "@/components/marketplace/RatingStars";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { MarketplacePromptReview, MarketplacePromptWithCreator } from "@/types";

type MarketplacePromptDetailClientProps = {
  prompt: MarketplacePromptWithCreator;
  reviews: MarketplacePromptReview[];
  moreFromCreator: MarketplacePromptWithCreator[];
  initialHasPurchased: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MarketplacePromptDetailClient({
  prompt,
  reviews: initialReviews,
  moreFromCreator,
  initialHasPurchased,
}: MarketplacePromptDetailClientProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasPurchased, setHasPurchased] = useState(initialHasPurchased);
  const [unlockedPrompt, setUnlockedPrompt] = useState(initialHasPurchased ? prompt.prompt_text : "");
  const [buying, setBuying] = useState(false);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(Number(prompt.rating_avg) || 0);
  const [ratingCount, setRatingCount] = useState(prompt.rating_count || 0);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const images = useMemo(() => {
    const list = [prompt.cover_image_url, ...(prompt.example_images ?? [])].filter(Boolean);
    return list.slice(0, 6);
  }, [prompt.cover_image_url, prompt.example_images]);

  async function getAccessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    if (!supabase || hasPurchased) return;

    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token || !active) return;

      const response = await fetch("/api/marketplace/my-purchases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok || !active) return;
      const payload = (await response.json().catch(() => ({}))) as {
        promptIds?: string[];
      };

      if (payload.promptIds?.includes(prompt.id)) {
        setHasPurchased(true);
        setUnlockedPrompt(prompt.prompt_text);
      }
    });

    return () => {
      active = false;
    };
  }, [supabase, hasPurchased, prompt.id, prompt.prompt_text]);

  async function buyPrompt() {
    if (hasPurchased) {
      setUnlockedPrompt(prompt.prompt_text);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Login required to purchase prompts");
      return;
    }

    setBuying(true);
    try {
      const response = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ marketplace_prompt_id: prompt.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.requiresPaymentMethod) {
          toast.error("Razorpay payment reference is required in this environment.");
          return;
        }
        throw new Error(payload.message || "Purchase failed");
      }

      setHasPurchased(true);
      setUnlockedPrompt(payload.prompt_text || prompt.prompt_text);
      toast.success(prompt.is_free ? "Prompt unlocked" : "Purchase complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getAccessToken();
    if (!token) {
      toast.error("Login required");
      return;
    }

    setSubmittingReview(true);
    try {
      const response = await fetch("/api/ratings/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          marketplace_prompt_id: prompt.id,
          rating: reviewRating,
          review_text: reviewText,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to submit review");
      }

      setRatingAvg(Number(payload.rating_avg) || ratingAvg);
      setRatingCount(Number(payload.rating_count) || ratingCount);

      setReviews((current) => {
        const next = current.filter((item) => item.user_id !== "me-temp");
        return [
          {
            id: `temp-${Date.now()}`,
            user_id: "me-temp",
            marketplace_prompt_id: prompt.id,
            rating: reviewRating,
            review_text: reviewText.trim() || null,
            created_at: new Date().toISOString(),
            user: {
              id: "me-temp",
              full_name: "You",
              avatar_url: null,
            },
          },
          ...next,
        ];
      });

      setReviewText("");
      toast.success("Review submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }

  const creatorName = prompt.creator?.display_name || "Community Creator";
  const resolvedPrice = Number(prompt.price_inr ?? prompt.price ?? 0);
  const priceLabel = prompt.is_free ? "Free" : `₹${resolvedPrice.toFixed(2)}`;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <TrackEvent
        eventType="prompt_view"
        metadata={{
          marketplace_prompt_id: prompt.id,
          source: "marketplace",
          category: prompt.category,
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="relative min-h-[440px] overflow-hidden rounded-2xl border border-border/60 bg-card/60">
            <Image
              src={images[activeIndex] || prompt.cover_image_url}
              alt={prompt.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 65vw"
            />

            {images.length > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setActiveIndex((index) => (index + 1) % images.length)}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-5 gap-2">
              {images.map((imageUrl, index) => (
                <button
                  type="button"
                  key={`${imageUrl}-${index}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border ${
                    activeIndex === index ? "border-primary" : "border-border/60"
                  }`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-current={activeIndex === index ? "true" : undefined}
                >
                  <Image src={imageUrl} alt={`Example ${index + 1}`} fill className="object-cover" sizes="120px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/70">
            <CardHeader className="space-y-3">
              <Badge>{prompt.category}</Badge>
              <CardTitle className="font-display text-3xl tracking-tight">{prompt.title}</CardTitle>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {prompt.creator?.avatar_url ? (
                  <Image
                    src={prompt.creator.avatar_url}
                    alt={creatorName}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {creatorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span>{creatorName}</span>
                {prompt.creator?.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {(prompt.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    #{tag}
                  </Badge>
                ))}
              </div>

              <RatingStars rating={ratingAvg} count={ratingCount} size="md" />
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold">{priceLabel}</p>
                </div>
                <Button onClick={buyPrompt} disabled={buying} className="gap-2">
                  {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : hasPurchased ? <WandSparkles className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                  {hasPurchased ? "Use This Prompt" : prompt.is_free ? "Get Free" : "Buy Now"}
                </Button>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-semibold">Description</h2>
                <p className="text-sm text-muted-foreground">{prompt.description}</p>
              </div>

              {hasPurchased && unlockedPrompt ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Unlocked Prompt</p>
                    <CopyButton value={unlockedPrompt} />
                  </div>
                  <pre className="whitespace-pre-wrap text-sm">{unlockedPrompt}</pre>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  Purchase this prompt to unlock full prompt text.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl font-semibold">Reviews ({ratingCount})</h2>

        {reviews.length ? (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id} className="border-border/60 bg-card/70">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{review.user?.full_name ?? "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
                  </div>
                  <RatingStars rating={review.rating} />
                  {review.review_text ? <p className="text-sm text-muted-foreground">{review.review_text}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            No reviews yet.
          </div>
        )}

        {hasPurchased ? (
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-lg">Leave a Review</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitReview}>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Rating</span>
                  <select
                    value={reviewRating}
                    onChange={(event) => setReviewRating(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} Star{value === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Review</span>
                  <textarea
                    rows={4}
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Share what worked well with this prompt..."
                  />
                </label>

                <Button type="submit" disabled={submittingReview}>
                  {submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit Review
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {moreFromCreator.length ? (
        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">More from this creator</h2>
            <Button variant="outline" asChild>
              <Link href="/marketplace">Browse all</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreFromCreator.map((item) => (
              <MarketplacePromptCard key={item.id} prompt={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
