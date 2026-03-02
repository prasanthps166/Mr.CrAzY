import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptDetailClient } from "@/components/marketplace/MarketplacePromptDetailClient";
import { getMarketplacePromptDetail } from "@/lib/marketplace";

type MarketplacePromptDetailPageProps = {
  params: {
    id: string;
  };
};

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
