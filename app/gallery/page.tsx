import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { AdBanner } from "@/components/AdBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { PromptCard } from "@/components/PromptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROMPT_CATEGORIES } from "@/lib/constants";
import { getPrompts, getRecommendedPrompts } from "@/lib/data";
import { buildPromptTagCloud, normalizePromptTag } from "@/lib/prompt-tags";
import { getViewerUserId } from "@/lib/server-user";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Prompt Gallery",
  description:
    "Explore trending AI prompts by category. Find portrait, anime, fantasy, and realistic styles for your next transformation.",
  path: "/gallery",
  keywords: ["AI prompts", "prompt styles", "trending prompts", "photo styles"],
});

const PAGE_SIZE = 18;
const MAX_PAGE_LIMIT = 72;

type GalleryPageProps = {
  searchParams: {
    category?: string;
    search?: string;
    sort?: string;
    tag?: string;
    limit?: string;
  };
};

function parseLimit(value: string | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PAGE_SIZE;
  return Math.max(PAGE_SIZE, Math.min(MAX_PAGE_LIMIT, Math.floor(numeric)));
}

function parseCategory(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "All";
  return (PROMPT_CATEGORIES as readonly string[]).includes(normalized) ? normalized : "All";
}

function parsePromptSort(value: string | undefined) {
  if (value === "newest") return "newest" as const;
  if (value === "most_used") return "most_used" as const;
  return "trending" as const;
}
function buildQuery(params: {
  category?: string;
  search?: string;
  sort?: string;
  tag?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.sort && params.sort !== "trending") query.set("sort", params.sort);
  if (params.tag) query.set("tag", params.tag);
  if (params.limit && params.limit > PAGE_SIZE) query.set("limit", String(params.limit));
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const category = parseCategory(searchParams.category);
  const search = searchParams.search ?? "";
  const trimmedSearch = search.trim();
  const sort = parsePromptSort(searchParams.sort);
  const selectedTag = normalizePromptTag(searchParams.tag ?? "");
  const requestedLimit = parseLimit(searchParams.limit);

  const viewerUserId = await getViewerUserId();

  const [promptsWithBuffer, recommendedPrompts] = await Promise.all([
    getPrompts({
      category,
      search,
      sort,
      tag: selectedTag,
      limit: Math.min(MAX_PAGE_LIMIT + 1, requestedLimit + 1),
    }),
    getRecommendedPrompts({
      userId: viewerUserId,
      limit: 6,
    }),
  ]);

  const hasMore = requestedLimit < MAX_PAGE_LIMIT && promptsWithBuffer.length > requestedLimit;
  const nextLimit = Math.min(MAX_PAGE_LIMIT, requestedLimit + PAGE_SIZE);
  const prompts = promptsWithBuffer.slice(0, requestedLimit);
  const tagOptions = buildPromptTagCloud(promptsWithBuffer, 12);
  const hasActiveFilters = category !== "All" || Boolean(trimmedSearch) || sort !== "trending" || Boolean(selectedTag);

  const galleryJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Prompt Gallery",
    url: absoluteUrl("/gallery"),
    itemListElement: prompts.slice(0, 24).map((prompt, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/gallery/${prompt.id}`),
      item: {
        "@type": "CreativeWork",
        name: prompt.title,
        description: prompt.description,
        image: prompt.example_image_url,
      },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <JsonLd id="gallery-jsonld" value={galleryJsonLd} />
      <div className="mb-8 space-y-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">Prompt Gallery</h1>
        <p className="text-muted-foreground">Browse curated styles and transform your photo in one click.</p>
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-card/60 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {PROMPT_CATEGORIES.map((item) => {
            const href = buildQuery({ category: item, search, sort, tag: selectedTag });
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
            <label htmlFor="gallery-search" className="sr-only">
              Search prompts
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="gallery-search"
              name="search"
              defaultValue={search}
              placeholder="Search prompts, tags, categories..."
              className="pl-9"
            />
          </div>
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="tag" value={selectedTag} />
          <label htmlFor="gallery-sort" className="sr-only">
            Sort prompts
          </label>
          <select
            id="gallery-sort"
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

        {tagOptions.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Popular tags:</span>
            <Button size="sm" variant={selectedTag ? "outline" : "default"} asChild>
              <Link href={`/gallery${buildQuery({ category, search, sort })}`}>All tags</Link>
            </Button>
            {tagOptions.map((option) => (
              <Button key={option.tag} size="sm" variant={selectedTag === option.tag ? "default" : "outline"} asChild>
                <Link
                  href={`/gallery${buildQuery({
                    category,
                    search,
                    sort,
                    tag: option.tag,
                  })}`}
                >
                  #{option.tag}
                </Link>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Active filters:</span>
          {category !== "All" ? <span>Category: {category}</span> : null}
          {selectedTag ? <span>Tag: #{selectedTag}</span> : null}
          {trimmedSearch ? <span>{`Search: "${trimmedSearch}"`}</span> : null}
          {sort !== "trending" ? <span>Sort: {sort.replace("_", " ")}</span> : null}
          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
            <Link href="/gallery">Clear all</Link>
          </Button>
        </div>
      ) : null}

      {category === "All" && !trimmedSearch && !selectedTag && recommendedPrompts.length ? (
        <section className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight">For You</h2>
            <p className="text-xs text-muted-foreground">Based on your recent activity</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedPrompts.map((prompt) => (
              <PromptCard key={`recommended-${prompt.id}`} prompt={prompt} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="mb-4 text-xs text-muted-foreground">
        Showing {prompts.length} {prompts.length === 1 ? "style" : "styles"}
      </p>

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

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" asChild>
            <Link
              href={`/gallery${buildQuery({
                category,
                search,
                sort,
                tag: selectedTag,
                limit: nextLimit,
              })}`}
            >
              Load more styles
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8">
        <AdBanner placement="gallery_bottom" className="w-full" />
      </div>
    </div>
  );
}