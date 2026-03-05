import type { Metadata } from "next";
import Link from "next/link";

import { AdBanner } from "@/components/AdBanner";
import { CommunityGrid } from "@/components/CommunityGrid";
import { CommunityFeedSection } from "@/components/community/CommunityFeedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROMPT_CATEGORIES } from "@/lib/constants";
import { getCommunityFeedPage } from "@/lib/community-feed-page";
import { buildMetadata } from "@/lib/seo";
import { getViewerUserId } from "@/lib/server-user";

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
    search?: string;
    sort?: string;
  };
};

function parseCategory(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "All";
  return (PROMPT_CATEGORIES as readonly string[]).includes(normalized) ? normalized : "All";
}
function categoryHref(
  category: string,
  scope: "all" | "following",
  search: string,
  sort: "latest" | "most_liked",
) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (scope === "following") params.set("scope", "following");
  if (search) params.set("search", search);
  if (sort !== "latest") params.set("sort", sort);
  const query = params.toString();
  return query ? `/community?${query}` : "/community";
}

function scopeHref(
  scope: "all" | "following",
  category: string,
  search: string,
  sort: "latest" | "most_liked",
) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (scope === "following") params.set("scope", "following");
  if (search) params.set("search", search);
  if (sort !== "latest") params.set("sort", sort);
  const query = params.toString();
  return query ? `/community?${query}` : "/community";
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const category = parseCategory(searchParams.category);
  const scope = searchParams.scope === "following" ? "following" : "all";
  const search = searchParams.search?.trim() ?? "";
  const sort = searchParams.sort === "most_liked" ? "most_liked" : "latest";
  const viewerUserId = await getViewerUserId();
  const followingOnly = scope === "following";
  const canRequestFeed = !(followingOnly && !viewerUserId);

  const [weekTopPage, feedPage] = canRequestFeed
    ? await Promise.all([
        getCommunityFeedPage({
          category,
          scope,
          viewerUserId,
          sort: "top_week",
          search,
          limit: 6,
          offset: 0,
        }),
        getCommunityFeedPage({
          category,
          scope,
          viewerUserId,
          sort: sort === "most_liked" ? "most_liked" : "recent",
          search,
          limit: 24,
          offset: 0,
        }),
      ])
    : [
        { posts: [], hasMore: false, nextOffset: 0 },
        { posts: [], hasMore: false, nextOffset: 0 },
      ];

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
          <Link href={scopeHref("all", category, search, sort)}>Everyone</Link>
        </Button>
        <Button variant={scope === "following" ? "default" : "outline"} size="sm" asChild>
          <Link href={scopeHref("following", category, search, sort)}>Following</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PROMPT_CATEGORIES.map((item) => (
          <Button key={item} variant={item === category ? "default" : "outline"} size="sm" asChild>
            <Link href={categoryHref(item, scope, search, sort)}>{item}</Link>
          </Button>
        ))}
      </div>

      <form method="get" className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <Input
          name="search"
          defaultValue={search}
          placeholder="Search prompt title, creator, category"
        />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="scope" value={scope} />
        <select
          name="sort"
          defaultValue={sort}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Sort feed"
        >
          <option value="latest">Latest</option>
          <option value="most_liked">Most Liked</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>

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
        <CommunityGrid posts={weekTopPage.posts} />
      </section>

      <CommunityFeedSection
        title={scope === "following" ? "Latest From Creators You Follow" : "Latest Posts"}
        initialPosts={feedPage.posts}
        initialHasMore={feedPage.hasMore}
        initialNextOffset={feedPage.nextOffset}
        category={category}
        scope={scope}
        search={search}
        sort={sort}
        canRequestMore={canRequestFeed}
      />

      <div className="mt-8">
        <AdBanner placement="community_bottom" className="w-full" />
      </div>
    </div>
  );
}
