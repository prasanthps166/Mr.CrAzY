import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, Flame, Layers3, Sparkles } from "lucide-react";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { CommunityGrid } from "@/components/CommunityGrid";
import { CopyButton } from "@/components/CopyButton";
import { PromptCard } from "@/components/PromptCard";
import { SavePromptButton } from "@/components/SavePromptButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPromptById, getPromptCommunityResults, getPrompts } from "@/lib/data";
import { normalizePromptTag } from "@/lib/prompt-tags";
import { rankRelatedPrompts } from "@/lib/recommendations";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

const GenerateModal = dynamic(
  () => import("@/components/GenerateModal").then((module) => module.GenerateModal),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="gap-2">
        Loading generator...
      </Button>
    ),
  },
);

type PromptDetailPageProps = {
  params: {
    id: string;
  };
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export async function generateMetadata({ params }: PromptDetailPageProps): Promise<Metadata> {
  const prompt = await getPromptById(params.id);

  if (!prompt) {
    return buildMetadata({
      title: "Prompt Not Found",
      description: "The requested prompt does not exist or is no longer available.",
      path: `/gallery/${params.id}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${prompt.title} Prompt`,
    description: prompt.description,
    path: `/gallery/${prompt.id}`,
    images: [{ url: prompt.example_image_url, alt: prompt.title }],
    keywords: [...prompt.tags, prompt.category, "AI prompt"],
  });
}

export default async function PromptDetailPage({ params }: PromptDetailPageProps) {
  const prompt = await getPromptById(params.id);
  if (!prompt) notFound();

  const [communityPosts, categoryPrompts] = await Promise.all([
    getPromptCommunityResults(prompt.id),
    getPrompts({
      category: prompt.category,
      sort: "trending",
      limit: 24,
    }),
  ]);

  const relatedPrompts = rankRelatedPrompts({
    sourcePrompt: prompt,
    candidates: categoryPrompts,
    limit: 8,
  })
    .filter((candidate) => candidate.id !== prompt.id)
    .slice(0, 6);

  const promptUrl = absoluteUrl(`/gallery/${prompt.id}`);
  const promptJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: prompt.title,
    description: prompt.description,
    image: prompt.example_image_url,
    keywords: prompt.tags.join(", "),
    url: promptUrl,
    about: prompt.category,
  };

  const primaryTags = prompt.tags.slice(0, 4);
  const promptSignals = [
    { label: "Category", value: prompt.category },
    { label: "Used", value: `${formatCount(prompt.use_count)} generations` },
    {
      label: "Top tags",
      value: primaryTags.length ? primaryTags.map((tag) => `#${tag}`).join(" • ") : "Curated style",
    },
  ];
  const fitCards = [
    {
      title: "Why it stands out",
      description: `This prompt pushes a ${prompt.category.toLowerCase()} direction with more art direction than a generic filter pass.`,
    },
    {
      title: "What it leans into",
      description: primaryTags.length
        ? `The strongest signals in this look are ${primaryTags.join(", ")}. That gives you a clearer starting point before you upload.`
        : "The overall finish is tuned to feel cleaner, more deliberate, and easier to share.",
    },
    {
      title: "How to use it",
      description: "Upload one portrait, generate once, and compare the result before saving, sharing, or trying a second variation.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:gap-10">
      <JsonLd id="gallery-detail-jsonld" value={promptJsonLd} />
      <TrackEvent
        eventType="prompt_view"
        metadata={{
          prompt_id: prompt.id,
          source: "gallery",
          category: prompt.category,
        }}
      />

      <div>
        <Link
          href={`/gallery?category=${encodeURIComponent(prompt.category)}`}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {prompt.category}
        </Link>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.03fr)_minmax(340px,0.77fr)]">
        <div className="relative overflow-hidden rounded-[2.25rem] border border-[#3d2918]/18 bg-[#21160d] text-amber-50 shadow-[0_35px_90px_-48px_rgba(69,38,14,0.9)]">
          <div className="absolute left-8 top-6 h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute bottom-8 right-8 h-28 w-28 rounded-full bg-[#ffcf9d]/12 blur-3xl" />
          <div className="relative aspect-[4/5] min-h-[420px]">
            <Image
              src={prompt.example_image_url}
              alt={prompt.title}
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 100vw, 58vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#110c07]/95 via-[#110c0735] to-transparent" />
            <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
              <Link href={`/gallery?category=${encodeURIComponent(prompt.category)}`} className="inline-flex">
                <Badge className="bg-primary/90 text-primary-foreground">{prompt.category}</Badge>
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-amber-50">
                <Flame className="h-3.5 w-3.5" />
                {formatCount(prompt.use_count)} uses
              </span>
              {prompt.is_sponsored ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-amber-50">
                  Sponsored prompt
                </span>
              ) : null}
            </div>
            <div className="absolute inset-x-5 bottom-5 rounded-[1.6rem] border border-white/10 bg-black/25 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/72">Signature Prompt</p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-5xl">
                {prompt.title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-amber-50/76">{prompt.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Ready To Generate
              </p>
              <h2 className="font-display text-3xl font-semibold leading-tight">
                Turn your photo into this look without writing the prompt yourself.
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                This page should make the decision easy: inspect the look, check the prompt text, then generate with
                one click.
              </p>
            </div>

            {prompt.is_sponsored ? (
              <div className="mt-5 flex items-center gap-3 rounded-[1.25rem] border border-border/60 bg-background/65 px-4 py-3 text-sm text-muted-foreground">
                {prompt.sponsor_logo_url ? (
                  <Image
                    src={prompt.sponsor_logo_url}
                    alt={prompt.sponsor_name ?? "Sponsor"}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                  />
                ) : null}
                <span>Powered by {prompt.sponsor_name ?? "Sponsor"}</span>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <GenerateModal
                prompt={prompt}
                triggerLabel="Generate This Look"
                triggerSize="lg"
                triggerClassName="shadow-lg shadow-primary/20"
              />
              <Button size="lg" variant="outline" asChild>
                <Link href={`/generate?prompt=${prompt.id}`}>
                  Open Full Generator
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <SavePromptButton promptId={prompt.id} />
              <CopyButton
                value={promptUrl}
                label="Copy Link"
                copiedLabel="Link Copied"
                successMessage="Prompt link copied"
                errorMessage="Unable to copy link"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {promptSignals.map((item) => (
                <div key={item.label} className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Where This Prompt Fits
            </p>
            <div className="mt-4 space-y-4">
              {fitCards.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-[1.35rem] border border-border/60 bg-background/65 p-4">
                  <div className="rounded-full bg-primary/12 p-2 text-primary">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Prompt Text</p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
                Inspect the exact prompt before you generate.
              </h2>
            </div>
            <CopyButton value={prompt.prompt_text} label="Copy Prompt" copiedLabel="Prompt Copied" />
          </div>
          <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-border/60 bg-background/75 p-5 text-sm leading-7 text-foreground/90">
            {prompt.prompt_text}
          </pre>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Style Family</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Browse the tags and related category.</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            If this prompt is close but not quite right, these links are the fastest way to stay in the same visual lane.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {primaryTags.length ? (
              primaryTags.map((tag) => {
                const normalizedTag = normalizePromptTag(tag);
                const href = `/gallery?category=${encodeURIComponent(prompt.category)}&tag=${encodeURIComponent(normalizedTag)}`;

                return (
                  <Link key={tag} href={href} className="inline-flex">
                    <Badge variant="secondary" className="px-3 py-1 text-sm transition hover:bg-secondary/90">
                      #{tag}
                    </Badge>
                  </Link>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground">No tags available for this prompt yet.</span>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Keep browsing
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Explore more prompts in {prompt.category} if you want the same mood with a different finish.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Conversion path
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Save it first if you are still comparing. Generate now if the example image already matches your taste.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href={`/gallery?category=${encodeURIComponent(prompt.category)}`}>
                More in {prompt.category}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/gallery">Back to full gallery</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2.25rem] border border-[#3d2918]/20 bg-[#21160d] px-5 py-6 text-amber-50 sm:px-7 sm:py-8">
        <div className="absolute left-[-8%] top-[-20%] h-40 w-40 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute bottom-[-16%] right-[-8%] h-40 w-40 rounded-full bg-[#ffcf9d]/12 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/70">
                <Layers3 className="h-3.5 w-3.5 text-amber-100" />
                Community Proof
              </p>
              <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
                {communityPosts.length
                  ? "See how this prompt performs on real uploads."
                  : "This prompt is waiting for its first public result."}
              </h2>
              <p className="text-base leading-7 text-amber-50/72">
                {communityPosts.length
                  ? "The strongest prompt pages do not stop at a polished demo image. They show how the style holds up across different people and photos."
                  : "Be the first to test it, then share the result to set the tone for everyone who lands here next."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/community">Browse Community</Link>
              </Button>
              <GenerateModal
                prompt={prompt}
                triggerLabel={communityPosts.length ? "Make Your Version" : "Create The First Result"}
                triggerVariant="outline"
                triggerSize="lg"
                triggerClassName="border-white/15 bg-transparent text-amber-50 hover:bg-white/10 hover:text-amber-50"
              />
            </div>
          </div>

          <div className="mt-6">
            {communityPosts.length ? (
              <CommunityGrid posts={communityPosts.slice(0, 6)} />
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-white/15 p-10 text-center text-sm text-amber-50/72">
                No community posts yet for this prompt.
              </div>
            )}
          </div>
        </div>
      </section>

      {relatedPrompts.length ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Keep Browsing
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Related prompts in the same lane</h2>
            </div>
            <Button variant="ghost" asChild>
              <Link href={`/gallery?category=${encodeURIComponent(prompt.category)}`}>More in {prompt.category}</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedPrompts.map((relatedPrompt) => (
              <PromptCard key={`related-${relatedPrompt.id}`} prompt={relatedPrompt} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
