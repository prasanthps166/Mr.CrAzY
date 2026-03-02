import Link from "next/link";
import { Fragment } from "react";
import { Sparkles, Store } from "lucide-react";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { MarketplacePromptCard } from "@/components/marketplace/MarketplacePromptCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MarketplacePriceFilter,
  MarketplaceSort,
  getMarketplaceCategories,
  getMarketplacePrompts,
} from "@/lib/marketplace";

type MarketplacePageProps = {
  searchParams: {
    tab?: "all" | "free";
    category?: string;
    price?: MarketplacePriceFilter;
    rating?: string;
    sort?: MarketplaceSort;
  };
};

function buildQuery(params: {
  tab?: "all" | "free";
  category?: string;
  price?: MarketplacePriceFilter;
  rating?: string;
  sort?: MarketplaceSort;
}) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "all") query.set("tab", params.tab);
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.price && params.price !== "all") query.set("price", params.price);
  if (params.rating && params.rating !== "0") query.set("rating", params.rating);
  if (params.sort && params.sort !== "trending") query.set("sort", params.sort);
  const value = query.toString();
  return value ? `?${value}` : "";
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

  const [categories, prompts] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplacePrompts({
      category,
      price,
      minRating: Number.isNaN(rating) ? 0 : rating,
      sort,
      tab,
    }),
  ]);

  const ctaInsertIndex = Math.ceil(prompts.length / 2);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <TrackEvent
        eventType="marketplace_view"
        metadata={{
          source: "marketplace_index",
          tab,
          category,
          sort,
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
            <Link href={`/marketplace${buildQuery({ tab: "all", category, price, rating: String(rating), sort })}`}>
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
              })}`}
            >
              Free Prompts
            </Link>
          </Button>
        </div>

        <form className="grid w-full gap-3 sm:w-auto sm:grid-cols-4">
          <select
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

          <select
            name="price"
            defaultValue={price}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Prices</option>
            <option value="free">Free</option>
            <option value="under_50">Under ₹50</option>
            <option value="under_100">Under ₹100</option>
          </select>

          <select
            name="rating"
            defaultValue={String(rating)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="0">All Ratings</option>
            <option value="3">3+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="5">5 Stars</option>
          </select>

          <select
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
          <Button type="submit" className="sm:col-span-4">
            Apply Filters
          </Button>
        </form>
      </div>

      {!prompts.length ? (
        <div className="rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No marketplace prompts matched your filters.
        </div>
      ) : (
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
      )}
    </div>
  );
}
