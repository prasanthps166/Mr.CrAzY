import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Flame, Search, SlidersHorizontal } from "lucide-react";

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

const TOP_WEEK_LIMIT = 4;
const FEED_PAGE_SIZE = 12;

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
  const followingOnly = scope === "following";
  const viewerUserId = followingOnly ? await getViewerUserId() : null;
  const canRequestFeed = !(followingOnly && !viewerUserId);
  const showTopWeek = scope === "all" && category === "All" && !search && sort === "latest";
  const hasActiveFilters = category !== "All" || scope !== "all" || Boolean(search) || sort !== "latest";

  const emptyPage = { posts: [], hasMore: false, nextOffset: 0 };
  const [weekTopPage, feedPage] = canRequestFeed
    ? await Promise.all([
        showTopWeek
          ? getCommunityFeedPage({
              category,
              scope,
              viewerUserId,
              sort: "top_week",
              search,
              limit: TOP_WEEK_LIMIT,
              offset: 0,
            })
          : Promise.resolve(emptyPage),
        getCommunityFeedPage({
          category,
          scope,
          viewerUserId,
          sort: sort === "most_liked" ? "most_liked" : "recent",
          search,
          limit: FEED_PAGE_SIZE,
          offset: 0,
        }),
      ])
    : [emptyPage, emptyPage];

  const topWeekLead = weekTopPage.posts[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:gap-10">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(320px,0.74fr)]">
        <div className="rounded-[2rem] border border-border/60 bg-card/72 px-5 py-6 sm:px-7 sm:py-7">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Compass className="h-3.5 w-3.5 text-primary" />
              Community Feed
            </p>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-5xl">
                See what the prompts look like in real hands.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Browse public posts, follow creators, and judge prompts by real output.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/72 px-3 py-1.5">
              {scope === "following" ? "Following feed" : "Everyone"}
            </span>
            <span className="rounded-full border border-border/60 bg-background/72 px-3 py-1.5">
              {category === "All" ? "All categories" : category}
            </span>
            <span className="rounded-full border border-border/60 bg-background/72 px-3 py-1.5">
              {sort === "most_liked" ? "Most liked" : "Latest first"}
            </span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#3d2918]/20 bg-[#21160d] px-5 py-6 text-amber-50 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/70">Most liked this week</p>
          <h2 className="mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl">
            {topWeekLead?.prompt_title ?? "See which transformations are actually landing"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-50/72">
            {topWeekLead
              ? `${topWeekLead.username} is currently leading the week with ${topWeekLead.likes} likes.`
              : "See which prompt and photo combinations are landing this week."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-amber-100/82">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {scope === "following" ? "Personalized feed" : "Public feed"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {sort === "most_liked" ? "Popularity mode" : "Fresh posts first"}
            </span>
          </div>
          <div className="mt-6">
            <Button
              variant="outline"
              className="border-white/15 bg-transparent text-amber-50 hover:bg-white/10 hover:text-amber-50"
              asChild
            >
              <Link href="/generate">
                Make your own post
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/60 bg-card/72 p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Refine The Feed</p>
              <h2 className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                Search first. Open more filters only when you need them.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={scope === "all" ? "default" : "outline"} size="sm" className="rounded-full" asChild>
                <Link href={scopeHref("all", category, search, sort)}>Everyone</Link>
              </Button>
              <Button
                variant={scope === "following" ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link href={scopeHref("following", category, search, sort)}>Following</Link>
              </Button>
            </div>
          </div>

          <form method="get" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Search prompt title, creator, category"
                className="h-11 rounded-full pl-10"
              />
            </div>
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="scope" value={scope} />
            <details className="rounded-[1.35rem] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                More filters
              </summary>
              <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PROMPT_CATEGORIES.map((item) => (
                      <Button
                        key={item}
                        variant={item === category ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        asChild
                      >
                        <Link href={categoryHref(item, scope, search, sort)}>{item}</Link>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sort</p>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="h-11 w-full rounded-full border border-input bg-background/85 px-4 text-sm"
                    aria-label="Sort feed"
                  >
                    <option value="latest">Latest</option>
                    <option value="most_liked">Most Liked</option>
                  </select>
                </div>
              </div>
            </details>
            <Button type="submit" className="h-11 rounded-full px-6">
              Apply Filters
            </Button>
          </form>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-border/60 bg-background/65 p-3 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-[0.16em] text-foreground">Active</span>
              {scope !== "all" ? <span>Scope: Following</span> : null}
              {category !== "All" ? <span>Category: {category}</span> : null}
              {search ? <span>{`Search: "${search}"`}</span> : null}
              {sort !== "latest" ? <span>Sort: Most liked</span> : null}
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-3" asChild>
                <Link href="/community">Clear all</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {followingOnly && !viewerUserId ? (
        <div className="rounded-[1.75rem] border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
          Login to see the creators you follow.{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Continue
          </Link>
          .
        </div>
      ) : null}

      {showTopWeek ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-primary" />
                This Week
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Most liked right now</h2>
            </div>
            <p className="text-sm text-muted-foreground">What is landing this week.</p>
          </div>
          <CommunityGrid posts={weekTopPage.posts} />
        </section>
      ) : null}

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

      <AdBanner placement="community_bottom" className="w-full" />
    </div>
  );
}
