import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { AdBanner } from "@/components/AdBanner";
import { PromptCard } from "@/components/PromptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROMPT_CATEGORIES } from "@/lib/constants";
import { getPrompts } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Prompt Gallery",
  description:
    "Explore trending AI prompts by category. Find portrait, anime, fantasy, and realistic styles for your next transformation.",
  path: "/gallery",
  keywords: ["AI prompts", "prompt styles", "trending prompts", "photo styles"],
});

type GalleryPageProps = {
  searchParams: {
    category?: string;
    search?: string;
    sort?: string;
  };
};

function buildQuery(params: { category?: string; search?: string; sort?: string }) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.sort && params.sort !== "trending") query.set("sort", params.sort);
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const category = searchParams.category ?? "All";
  const search = searchParams.search ?? "";
  const sort = (searchParams.sort ?? "trending") as "trending" | "newest" | "most_used";

  const prompts = await getPrompts({
    category,
    search,
    sort,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">Prompt Gallery</h1>
        <p className="text-muted-foreground">Browse curated styles and transform your photo in one click.</p>
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-card/60 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {PROMPT_CATEGORIES.map((item) => {
            const href = buildQuery({ category: item, search, sort });
            const active = category === item;
            return (
              <Button key={item} variant={active ? "default" : "outline"} size="sm" asChild>
                <Link href={`/gallery${href}`}>{item}</Link>
              </Button>
            );
          })}
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="search"
              defaultValue={search}
              placeholder="Search prompts, tags, categories..."
              className="pl-9"
            />
          </div>
          <input type="hidden" name="category" value={category === "All" ? "" : category} />
          <select
            name="sort"
            defaultValue={sort}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="most_used">Most Used</option>
          </select>
          <Button type="submit">Apply</Button>
        </form>
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          No prompts matched your filters.
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="mb-4 break-inside-avoid">
              <PromptCard prompt={prompt} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <AdBanner placement="gallery_bottom" className="w-full" />
      </div>
    </div>
  );
}
