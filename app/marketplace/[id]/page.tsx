import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptDetailClient } from "@/components/marketplace/MarketplacePromptDetailClient";
import { getMarketplacePromptDetail } from "@/lib/marketplace";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

type MarketplacePromptDetailPageProps = {
  params: {
    id: string;
  };
};

export async function generateMetadata({ params }: MarketplacePromptDetailPageProps): Promise<Metadata> {
  const data = await getMarketplacePromptDetail(params.id, null);

  if (!data.prompt) {
    return buildMetadata({
      title: "Marketplace Prompt Not Found",
      description: "The requested marketplace prompt does not exist or is no longer available.",
      path: `/marketplace/${params.id}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${data.prompt.title} - Marketplace Prompt`,
    description: data.prompt.description,
    path: `/marketplace/${data.prompt.id}`,
    images: [{ url: data.prompt.cover_image_url, alt: data.prompt.title }],
    keywords: [data.prompt.category, "marketplace prompt", "AI creator prompt"],
  });
}

async function getServerUserId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // No-op in server component.
      },
      remove() {
        // No-op in server component.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export default async function MarketplacePromptDetailPage({ params }: MarketplacePromptDetailPageProps) {
  const userId = await getServerUserId();
  const data = await getMarketplacePromptDetail(params.id, userId);

  if (!data.prompt) notFound();
  const prompt = data.prompt;
  const priceInr = Number(prompt.price_inr ?? prompt.price ?? 0).toFixed(2);
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: prompt.title,
    description: prompt.description,
    image: [prompt.cover_image_url, ...(prompt.example_images ?? [])].filter(Boolean),
    sku: prompt.id,
    category: prompt.category,
    brand: {
      "@type": "Brand",
      name: prompt.creator?.display_name ?? "PromptGallery Creator",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: prompt.is_free ? "0.00" : priceInr,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/marketplace/${prompt.id}`),
    },
  };

  if ((prompt.rating_count ?? 0) > 0) {
    productJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(prompt.rating_avg ?? 0).toFixed(2),
      ratingCount: prompt.rating_count,
    };
  }

  const reviewsForSchema = data.reviews.slice(0, 5).map((review) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      "@type": "Person",
      name: review.user?.full_name ?? "PromptGallery User",
    },
    reviewBody: review.review_text ?? "",
    datePublished: review.created_at,
  }));
  if (reviewsForSchema.length) {
    productJsonLd.review = reviewsForSchema;
  }

  return (
    <>
      <JsonLd id="marketplace-detail-jsonld" value={productJsonLd} />
      <TrackEvent
        eventType="marketplace_view"
        metadata={{
          source: "marketplace_detail",
          marketplace_prompt_id: prompt.id,
          category: prompt.category,
        }}
      />
      <MarketplacePromptDetailClient
        prompt={prompt}
        reviews={data.reviews}
        moreFromCreator={data.moreFromCreator}
        initialHasPurchased={data.hasPurchased}
      />
    </>
  );
}
