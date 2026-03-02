import Image from "next/image";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

import { TrackEvent } from "@/components/analytics/TrackEvent";
import { CommunityGrid } from "@/components/CommunityGrid";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPromptById, getPromptCommunityResults } from "@/lib/data";

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

export default async function PromptDetailPage({ params }: PromptDetailPageProps) {
  const prompt = await getPromptById(params.id);
  if (!prompt) notFound();

  const communityPosts = await getPromptCommunityResults(prompt.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
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
          <Badge>{prompt.category}</Badge>
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
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prompt text</p>
              <CopyButton value={prompt.prompt_text} />
            </div>
            <pre className="whitespace-pre-wrap text-sm text-foreground/90">{prompt.prompt_text}</pre>
          </div>

          <GenerateModal prompt={prompt} triggerLabel="Use This Prompt" />
        </div>
      </div>

      <section className="mt-14 space-y-4">
        <h2 className="font-display text-2xl font-semibold">Community Results</h2>
        <CommunityGrid posts={communityPosts} />
      </section>
    </div>
  );
}
