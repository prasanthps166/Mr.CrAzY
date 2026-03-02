import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptDetailClient } from "@/components/marketplace/MarketplacePromptDetailClient";
import { getMarketplacePromptDetail } from "@/lib/marketplace";
import { buildMetadata } from "@/lib/seo";

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

  return (
    <>
      <TrackEvent
        eventType="marketplace_view"
        metadata={{
          source: "marketplace_detail",
          marketplace_prompt_id: data.prompt.id,
          category: data.prompt.category,
        }}
      />
      <MarketplacePromptDetailClient
        prompt={data.prompt}
        reviews={data.reviews}
        moreFromCreator={data.moreFromCreator}
        initialHasPurchased={data.hasPurchased}
      />
    </>
  );
}
