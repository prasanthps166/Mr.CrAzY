import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Flame, Sparkles, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPromptById, getPrompts } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Generate AI Images",
  description:
    "Upload your photo, choose a prompt, and generate AI-transformed images with adjustable style strength.",
  path: "/generate",
  keywords: ["generate AI image", "img2img", "photo transformer", "AI photo editor"],
});

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

const setupSteps = [
  {
    title: "Pick the look",
    description: "Start from a prompt that already feels close to the result you want instead of guessing from scratch.",
  },
  {
    title: "Upload one portrait",
    description: "Use a clear image with a visible face so the style has enough signal to transform well.",
  },
  {
    title: "Tune and generate",
    description: "Adjust strength in the modal, generate once, then keep or retry based on the first output.",
  },
] as const;

const uploadChecks = [
  "Use a sharp portrait with the face clearly visible.",
  "Avoid heavy compression, extreme blur, or multiple faces.",
  "Try one clean image first before experimenting with harder inputs.",
] as const;

type GeneratePageProps = {
  searchParams: {
    prompt?: string;
  };
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const [prompts, selectedPromptById] = await Promise.all([
    getPrompts({ limit: 10, sort: "trending" }),
    searchParams.prompt ? getPromptById(searchParams.prompt) : Promise.resolve(null),
  ]);
  const selectedPrompt = selectedPromptById ?? prompts[0] ?? null;

  if (!selectedPrompt) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <p className="text-sm text-muted-foreground">No prompts available yet.</p>
      </div>
    );
  }

  const promptChoices = [selectedPrompt, ...prompts.filter((prompt) => prompt.id !== selectedPrompt.id)].slice(0, 8);
  const visibleTags = selectedPrompt.tags.slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:gap-10">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.78fr)]">
        <div className="relative overflow-hidden rounded-[2.25rem] border border-[#3d2918]/18 bg-[#21160d] text-amber-50 shadow-[0_35px_90px_-48px_rgba(69,38,14,0.9)]">
          <div className="absolute left-8 top-6 h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute bottom-8 right-8 h-28 w-28 rounded-full bg-[#ffcf9d]/12 blur-3xl" />
          <div className="relative aspect-[16/10] min-h-[420px]">
            <Image
              src={selectedPrompt.example_image_url}
              alt={selectedPrompt.title}
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 100vw, 58vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#110c07]/95 via-[#110c0735] to-transparent" />
            <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/90 text-primary-foreground">{selectedPrompt.category}</Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-amber-50">
                <Flame className="h-3.5 w-3.5" />
                {formatCount(selectedPrompt.use_count)} uses
              </span>
            </div>
            <div className="absolute inset-x-5 bottom-5 rounded-[1.6rem] border border-white/10 bg-black/25 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/72">Selected Style</p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-5xl">
                Generate with {selectedPrompt.title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-amber-50/76">{selectedPrompt.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <WandSparkles className="h-3.5 w-3.5 text-primary" />
                Generation Studio
              </p>
              <h2 className="font-display text-3xl font-semibold leading-tight">
                Upload one photo and turn it into a finished look.
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Pick the prompt that already feels right, then use the generator modal to upload, tune strength, and
                export the first version fast.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <GenerateModal
                prompt={selectedPrompt}
                triggerLabel="Upload and Generate"
                triggerSize="lg"
                triggerClassName="shadow-lg shadow-primary/20"
              />
              <Button size="lg" variant="outline" asChild>
                <Link href={`/gallery/${selectedPrompt.id}`}>
                  View Prompt Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedPrompt.category}</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {visibleTags.length ? visibleTags.join(", ") : "Portrait transformations"}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Flow</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Upload, generate, download, share.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Before You Upload</p>
            <div className="mt-4 space-y-4">
              {uploadChecks.map((item) => (
                <div key={item} className="flex gap-3 rounded-[1.35rem] border border-border/60 bg-background/65 p-4">
                  <div className="rounded-full bg-primary/12 p-2 text-primary">
                    <Check className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {setupSteps.map((step, index) => (
          <div
            key={step.title}
            className="rounded-[1.75rem] border border-border/60 bg-card/72 p-5 shadow-[0_18px_40px_-32px_rgba(42,29,18,0.7)]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Step 0{index + 1}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight">{step.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Selected Prompt</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
            Start from a look that already matches your taste.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The easiest way to get a strong first generation is to choose a style whose example image already feels
            close to your goal.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="px-3 py-1 text-sm">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-background/70 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Need more context?</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Open the prompt detail page if you want to inspect the full prompt text, tags, community results, and
              related styles before you generate.
            </p>
            <div className="mt-4">
              <Button variant="outline" asChild>
                <Link href={`/gallery/${selectedPrompt.id}`}>Inspect Prompt Detail</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card/75 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Prompt Picker
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Switch styles without leaving the page.</h2>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/gallery">Browse full gallery</Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-3">
            {promptChoices.map((prompt) => {
              const active = prompt.id === selectedPrompt.id;

              return (
                <Link
                  key={prompt.id}
                  href={`/generate?prompt=${prompt.id}`}
                  className={`group grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 rounded-[1.45rem] border p-3 transition ${
                    active
                      ? "border-primary/30 bg-primary/8 shadow-[0_18px_40px_-34px_rgba(199,102,43,0.65)]"
                      : "border-border/60 bg-background/70 hover:border-primary/20 hover:bg-background/90"
                  }`}
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem]">
                    <Image
                      src={prompt.example_image_url}
                      alt={prompt.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="92px"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={active ? "default" : "secondary"}>{prompt.category}</Badge>
                      <span className="text-xs text-muted-foreground">{formatCount(prompt.use_count)} uses</span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 font-display text-2xl leading-tight">{prompt.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{prompt.description}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {active ? "Selected" : "Choose"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
