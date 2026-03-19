import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { AdBanner } from "@/components/AdBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { PromptCard } from "@/components/PromptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROMPT_CATEGORIES } from "@/lib/constants";
import { getPrompts } from "@/lib/data";
import { buildPromptTagCloud, normalizePromptTag } from "@/lib/prompt-tags";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

const RecommendedPromptsSection = nextDynamic(
  () => import("@/components/RecommendedPromptsSection").then((module) => module.RecommendedPromptsSection),
  { ssr: false },
);

export const metadata: Metadata = buildMetadata({
  title: "Prompt Gallery",
  description:
    "Explore trending AI prompts by category. Find portrait, anime, fantasy, and realistic styles for your next transformation.",
  path: "/gallery",
  keywords: ["AI prompts", "prompt styles", "trending prompts", "photo styles"],
});

const PAGE_SIZE = 12;
const MAX_PAGE_LIMIT = 60;

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

  const shouldLoadRecommendations = category === "All" && !trimmedSearch && !selectedTag;

  const promptsWithBuffer = await getPrompts({
    category,
    search,
    sort,
    tag: selectedTag,
    limit: Math.min(MAX_PAGE_LIMIT + 1, requestedLimit + 1),
  });

  const hasMore = requestedLimit < MAX_PAGE_LIMIT && promptsWithBuffer.length > requestedLimit;
  const nextLimit = Math.min(MAX_PAGE_LIMIT, requestedLimit + PAGE_SIZE);
  const prompts = promptsWithBuffer.slice(0, requestedLimit);
  const tagOptions = buildPromptTagCloud(promptsWithBuffer, 12);
  const hasActiveFilters = category !== "All" || Boolean(trimmedSearch) || sort !== "trending" || Boolean(selectedTag);
  const leadPrompt = prompts[0] ?? null;

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:gap-10">
      <JsonLd id="gallery-jsonld" value={galleryJsonLd} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]">
        <div className="rounded-[2rem] border border-border/60 bg-card/72 px-5 py-6 sm:px-7 sm:py-7">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Browse Curated Styles
            </p>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-5xl">
                Find a prompt that already looks finished.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Start from styles that already have a point of view instead of guessing your way through prompt text.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Showing</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{prompts.length} ready-to-use looks</p>
            </div>
            <div className="rounded-[1.4rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Current mode</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {category === "All" ? "All categories" : category}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sort</p>
              <p className="mt-2 text-lg font-semibold capitalize text-foreground">{sort.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#3d2918]/20 bg-[#21160d] px-5 py-6 text-amber-50 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/70">Current spotlight</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight">
            {leadPrompt?.title ?? "Curated transformations worth trying first"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-50/72">
            {leadPrompt?.description ??
              "Browse the strongest portrait, avatar, and cinematic edits without digging through low-signal results."}
          </p>
          {leadPrompt ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-amber-100/82">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{leadPrompt.category}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {leadPrompt.use_count} generations
              </span>
            </div>
          ) : null}
          <div className="mt-6">
            <Button
              variant="outline"
              className="border-white/15 bg-transparent text-amber-50 hover:bg-white/10 hover:text-amber-50"
              asChild
            >
              <Link href={leadPrompt ? `/gallery/${leadPrompt.id}` : "/generate"}>
                {leadPrompt ? "Open featured prompt" : "Try generating"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border/60 bg-card/72 p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Refine Your Search
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Browse with more intent.</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 py-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Filter by category, search, tag, or sort
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PROMPT_CATEGORIES.map((item) => {
              const href = buildQuery({ category: item, search, sort, tag: selectedTag });
              const active = category === item;
              return (
                <Button
                  key={item}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  asChild
                >
                  <Link href={`/gallery${href}`}>{item}</Link>
                </Button>
              );
            })}
          </div>

          <form className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
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
                className="h-11 rounded-full pl-10"
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
              className="h-11 rounded-full border border-input bg-background/85 px-4 text-sm"
            >
              <option value="trending">Trending</option>
              <option value="newest">Newest</option>
              <option value="most_used">Most Used</option>
            </select>
            <Button type="submit" className="h-11 rounded-full px-6">
              Apply Filters
            </Button>
          </form>

          {tagOptions.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Popular tags</span>
              <Button size="sm" variant={selectedTag ? "outline" : "default"} className="rounded-full" asChild>
                <Link href={`/gallery${buildQuery({ category, search, sort })}`}>All tags</Link>
              </Button>
              {tagOptions.map((option) => (
                <Button
                  key={option.tag}
                  size="sm"
                  variant={selectedTag === option.tag ? "default" : "outline"}
                  className="rounded-full"
                  asChild
                >
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

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-border/60 bg-background/65 p-3 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-[0.16em] text-foreground">Active</span>
              {category !== "All" ? <span>Category: {category}</span> : null}
              {selectedTag ? <span>Tag: #{selectedTag}</span> : null}
              {trimmedSearch ? <span>{`Search: "${trimmedSearch}"`}</span> : null}
              {sort !== "trending" ? <span>Sort: {sort.replace("_", " ")}</span> : null}
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-3" asChild>
                <Link href="/gallery">Clear all</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {shouldLoadRecommendations ? (
        <RecommendedPromptsSection
          title="For You"
          description="Once you have activity, the gallery can surface prompts that fit your taste faster."
          limit={6}
          className="space-y-4"
        />
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Results</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
              {hasActiveFilters ? "Filtered prompt matches" : "All signature looks"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {prompts.length} {prompts.length === 1 ? "style" : "styles"}
          </p>
        </div>

        {prompts.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
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
      </section>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" className="rounded-full px-6" asChild>
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

      <AdBanner placement="gallery_bottom" className="w-full" />
    </div>
  );
}
