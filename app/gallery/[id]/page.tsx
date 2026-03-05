import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

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
    limit: 6,
  });

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <JsonLd id="gallery-detail-jsonld" value={promptJsonLd} />
      <TrackEvent
        eventType="prompt_view"
        metadata={{
          prompt_id: prompt.id,
          source: "gallery",
          category: prompt.category,
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border/60">
          <Image
            src={prompt.example_image_url}
            alt={prompt.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-6">
          <Link href={`/gallery?category=${encodeURIComponent(prompt.category)}`} className="inline-flex">
            <Badge>{prompt.category}</Badge>
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">{prompt.title}</h1>
          {prompt.is_sponsored ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              {prompt.sponsor_logo_url ? (
                <Image
                  src={prompt.sponsor_logo_url}
                  alt={prompt.sponsor_name ?? "Sponsor"}
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              ) : null}
              <span>Powered by {prompt.sponsor_name ?? "Sponsor"}</span>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">{prompt.description}</p>
          <div className="flex flex-wrap gap-2">
            {prompt.tags.map((tag) => {
              const normalizedTag = normalizePromptTag(tag);
              const href = `/gallery?category=${encodeURIComponent(prompt.category)}&tag=${encodeURIComponent(normalizedTag)}`;

              return (
                <Link key={tag} href={href} className="inline-flex">
                  <Badge variant="secondary" className="transition hover:bg-secondary/80">
                    #{tag}
                  </Badge>
                </Link>
              );
            })}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prompt text</p>
              <CopyButton value={prompt.prompt_text} label="Copy Prompt" copiedLabel="Prompt Copied" />
            </div>
            <pre className="whitespace-pre-wrap text-sm text-foreground/90">{prompt.prompt_text}</pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <GenerateModal prompt={prompt} triggerLabel="Use This Prompt" />
            <SavePromptButton promptId={prompt.id} />
            <CopyButton
              value={promptUrl}
              label="Copy Link"
              copiedLabel="Link Copied"
              successMessage="Prompt link copied"
              errorMessage="Unable to copy link"
            />
          </div>
        </div>
      </div>

      <section className="mt-14 space-y-4">
        <h2 className="font-display text-2xl font-semibold">Community Results</h2>
        <CommunityGrid posts={communityPosts} />
      </section>

      {relatedPrompts.length ? (
        <section className="mt-14 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Related Prompts</h2>
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