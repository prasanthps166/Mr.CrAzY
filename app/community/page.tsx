import type { Metadata } from "next";
import Link from "next/link";

import { AdBanner } from "@/components/AdBanner";
import { CommunityGrid } from "@/components/CommunityGrid";
import { Button } from "@/components/ui/button";
import { PROMPT_CATEGORIES } from "@/lib/constants";
import { getCommunityFeed } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Community Creations",
  description:
    "Discover the latest public AI image transformations, most-liked creations, and trending visual styles from the community.",
  path: "/community",
  keywords: ["AI community", "user creations", "AI art feed", "promptgallery community"],
});

type CommunityPageProps = {
  searchParams: {
    category?: string;
  };
};

function categoryHref(category: string) {
  if (category === "All") return "/community";
  return `/community?category=${encodeURIComponent(category)}`;
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const category = searchParams.category ?? "All";
  const [weekTop, feed] = await Promise.all([
    getCommunityFeed({
      category,
      limit: 6,
      mostLikedThisWeek: true,
    }),
    getCommunityFeed({
      category,
      limit: 24,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground">
          Explore public generations, save inspiration, and like your favorites.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PROMPT_CATEGORIES.map((item) => (
          <Button key={item} variant={item === category ? "default" : "outline"} size="sm" asChild>
            <Link href={categoryHref(item)}>{item}</Link>
          </Button>
        ))}
      </div>

      <section className="mb-10 space-y-4">
        <h2 className="font-display text-2xl font-semibold">Most Liked This Week</h2>
        <CommunityGrid posts={weekTop} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Latest Posts</h2>
        <CommunityGrid posts={feed} />
      </section>

      <div className="mt-8">
        <AdBanner placement="community_bottom" className="w-full" />
      </div>
    </div>
  );
}
