import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Sparkles, Store } from "lucide-react";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptCard } from "@/components/marketplace/MarketplacePromptCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MarketplacePriceFilter,
  MarketplaceSort,
  getMarketplaceCategories,
  getMarketplacePrompts,
} from "@/lib/marketplace";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

const PAGE_SIZE = 24;
const MAX_PAGE_LIMIT = 240;

export const metadata: Metadata = buildMetadata({
  title: "Prompt Marketplace",
  description:
    "Buy premium AI prompts from creators, discover top-rated styles, and unlock marketplace-only transformations.",
  path: "/marketplace",
  keywords: ["prompt marketplace", "buy AI prompts", "creator prompts", "premium AI styles"],
});

type MarketplacePageProps = {
  searchParams: {
    tab?: "all" | "free";
    category?: string;
    price?: MarketplacePriceFilter;
    rating?: string;
    sort?: MarketplaceSort;
    search?: string;
    limit?: string;
  };
};

function buildQuery(params: {
  tab?: "all" | "free";
  category?: string;
  price?: MarketplacePriceFilter;
  rating?: string;
  sort?: MarketplaceSort;
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "all") query.set("tab", params.tab);
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.price && params.price !== "all") query.set("price", params.price);
  if (params.rating && params.rating !== "0") query.set("rating", params.rating);
  if (params.sort && params.sort !== "trending") query.set("sort", params.sort);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if ((params.limit ?? PAGE_SIZE) > PAGE_SIZE) query.set("limit", String(params.limit));
  const value = query.toString();
  return value ? `?${value}` : "";
}

function parseMarketplaceLimit(value?: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PAGE_SIZE;
  return Math.max(PAGE_SIZE, Math.min(MAX_PAGE_LIMIT, Math.floor(numeric)));
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const tab = searchParams.tab === "free" ? "free" : "all";
  const category = searchParams.category ?? "All";
  const allowedPrices: MarketplacePriceFilter[] = ["all", "free", "under_50", "under_100"];
  const allowedSorts: MarketplaceSort[] = ["trending", "newest", "top_rated", "best_selling"];
  const price = allowedPrices.includes(searchParams.price ?? "all") ? (searchParams.price ?? "all") : "all";
  const ratingValue = Number(searchParams.rating ?? "0");
  const rating = Number.isFinite(ratingValue) ? ratingValue : 0;
  const sort = allowedSorts.includes(searchParams.sort ?? "trending")
    ? (searchParams.sort ?? "trending")
    : "trending";
  const search = searchParams.search?.trim() ?? "";
  const requestedLimit = parseMarketplaceLimit(searchParams.limit);

  const [categories, promptRows] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplacePrompts({
      category,
      price,
      minRating: Number.isNaN(rating) ? 0 : rating,
      sort,
      tab,
      search,
      limit: Math.min(requestedLimit + 1, MAX_PAGE_LIMIT),
    }),
  ]);

  const hasMore = promptRows.length > requestedLimit;
  const prompts = hasMore ? promptRows.slice(0, requestedLimit) : promptRows;
  const nextLimit = Math.min(requestedLimit + PAGE_SIZE, MAX_PAGE_LIMIT);
  const canLoadMore = hasMore && requestedLimit < MAX_PAGE_LIMIT;

  const marketplaceJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Prompt Marketplace",
    url: absoluteUrl("/marketplace"),
    itemListElement: prompts.slice(0, 24).map((prompt, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/marketplace/${prompt.id}`),
      item: {
        "@type": "Product",
        name: prompt.title,
        description: prompt.description,
        image: prompt.cover_image_url,
        category: prompt.category,
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: prompt.is_free ? "0.00" : Number(prompt.price_inr ?? prompt.price ?? 0).toFixed(2),
          availability: "https://schema.org/InStock",
          url: absoluteUrl(`/marketplace/${prompt.id}`),
        },
      },
    })),
  };

  const ctaInsertIndex = Math.ceil(prompts.length / 2);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <JsonLd id="marketplace-jsonld" value={marketplaceJsonLd} />
      <TrackEvent
        eventType="marketplace_view"
        metadata={{
          source: "marketplace_index",
          tab,
          category,
          sort,
          search,
        }}
      />

      <section className="mb-8 rounded-2xl border border-border/60 bg-card/70 p-6">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
          <Store className="h-3.5 w-3.5" />
          Prompt Marketplace
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Buy & Sell AI Prompts - Crafted by the Community
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Discover premium creator prompts, unlock styles instantly, and sell your own prompt packs.
        </p>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant={tab === "all" ? "default" : "outline"} size="sm" asChild>
            <Link
              href={`/marketplace${buildQuery({
                tab: "all",
                category,
                price,
                rating: String(rating),
                sort,
                search,
                limit: requestedLimit,
              })}`}
            >
              All Prompts
            </Link>
          </Button>
          <Button variant={tab === "free" ? "default" : "outline"} size="sm" asChild>
            <Link
              href={`/marketplace${buildQuery({
                tab: "free",
                category,
                price,
                rating: String(rating),
                sort,
                search,
                limit: requestedLimit,
              })}`}
            >
              Free Prompts
            </Link>
          </Button>
        </div>

        <form className="grid w-full gap-3 sm:w-auto sm:grid-cols-5">
          <label htmlFor="marketplace-search" className="sr-only">
            Search prompts
          </label>
          <Input
            id="marketplace-search"
            name="search"
            defaultValue={search}
            placeholder="Search title, description, category"
            className="sm:col-span-2"
          />

          <label htmlFor="marketplace-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="marketplace-category"
            name="category"
            defaultValue={category}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label htmlFor="marketplace-price" className="sr-only">
            Filter by price
          </label>
          <select
            id="marketplace-price"
            name="price"
            defaultValue={price}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Prices</option>
            <option value="free">Free</option>
            <option value="under_50">Under Rs 50</option>
            <option value="under_100">Under Rs 100</option>
          </select>

          <label htmlFor="marketplace-rating" className="sr-only">
            Filter by rating
          </label>
          <select
            id="marketplace-rating"
            name="rating"
            defaultValue={String(rating)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="0">All Ratings</option>
            <option value="3">3+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="5">5 Stars</option>
          </select>

          <label htmlFor="marketplace-sort" className="sr-only">
            Sort marketplace prompts
          </label>
          <select
            id="marketplace-sort"
            name="sort"
            defaultValue={sort}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="top_rated">Top Rated</option>
            <option value="best_selling">Best Selling</option>
          </select>

          <input type="hidden" name="tab" value={tab} />
          <div className="flex gap-2 sm:col-span-5">
            <Button type="submit" className="flex-1">
              Apply Filters
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/marketplace">Clear</Link>
            </Button>
          </div>
        </form>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Showing {prompts.length} prompt(s){search ? ` for "${search}"` : ""}.
      </p>

      {!prompts.length ? (
        <div className="rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No marketplace prompts matched your filters.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prompts.map((prompt, index) => (
              <Fragment key={prompt.id}>
                {index === ctaInsertIndex ? (
                  <Card className="col-span-full border-primary/40 bg-primary/10">
                    <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-semibold">Become a Creator</p>
                        <p className="text-sm text-muted-foreground">
                          Publish your own prompts, reach a global audience, and keep 70% of every sale.
                        </p>
                      </div>
                      <Button asChild>
                        <Link href="/creator/signup" className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          Start Selling
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
                <MarketplacePromptCard prompt={prompt} />
              </Fragment>
            ))}
          </div>

          {canLoadMore ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" asChild>
                <Link
                  href={`/marketplace${buildQuery({
                    tab,
                    category,
                    price,
                    rating: String(rating),
                    sort,
                    search,
                    limit: nextLimit,
                  })}`}
                >
                  Load More
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}