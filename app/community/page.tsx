import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
    scope?: string;
  };
};

function categoryHref(category: string, scope: "all" | "following") {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (scope === "following") params.set("scope", "following");
  const query = params.toString();
  return query ? `/community?${query}` : "/community";
}

function scopeHref(scope: "all" | "following", category: string) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (scope === "following") params.set("scope", "following");
  const query = params.toString();
  return query ? `/community?${query}` : "/community";
}

async function getViewerUserId() {
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

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const category = searchParams.category ?? "All";
  const scope = searchParams.scope === "following" ? "following" : "all";
  const viewerUserId = await getViewerUserId();
  const followingOnly = scope === "following";

  const [weekTop, feed] =
    followingOnly && !viewerUserId
      ? [[], []]
      : await Promise.all([
          getCommunityFeed({
            category,
            limit: 6,
            mostLikedThisWeek: true,
            scope,
            viewerUserId,
          }),
          getCommunityFeed({
            category,
            limit: 24,
            scope,
            viewerUserId,
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

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={scope === "all" ? "default" : "outline"} size="sm" asChild>
          <Link href={scopeHref("all", category)}>Everyone</Link>
        </Button>
        <Button variant={scope === "following" ? "default" : "outline"} size="sm" asChild>
          <Link href={scopeHref("following", category)}>Following</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PROMPT_CATEGORIES.map((item) => (
          <Button key={item} variant={item === category ? "default" : "outline"} size="sm" asChild>
            <Link href={categoryHref(item, scope)}>{item}</Link>
          </Button>
        ))}
      </div>

      {followingOnly && !viewerUserId ? (
        <div className="mb-10 rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
          Follow creators to view your personalized feed.{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Login to continue
          </Link>
          .
        </div>
      ) : null}

      <section className="mb-10 space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {scope === "following" ? "Most Liked This Week (Following)" : "Most Liked This Week"}
        </h2>
        <CommunityGrid posts={weekTop} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {scope === "following" ? "Latest From Creators You Follow" : "Latest Posts"}
        </h2>
        <CommunityGrid posts={feed} />
      </section>

      <div className="mt-8">
        <AdBanner placement="community_bottom" className="w-full" />
      </div>
    </div>
  );
}
