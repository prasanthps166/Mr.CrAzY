import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPromptById, getPrompts } from "@/lib/data";

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

type GeneratePageProps = {
  searchParams: {
    prompt?: string;
  };
};

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const prompts = await getPrompts({ limit: 12, sort: "trending" });
  const selectedPrompt =
    (searchParams.prompt ? await getPromptById(searchParams.prompt) : null) ?? prompts[0] ?? null;

  if (!selectedPrompt) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <p className="text-sm text-muted-foreground">No prompts available yet.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Generate</h1>
        <p className="text-muted-foreground">
          Select a style, upload your image, and generate your transformed output.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-border/60 bg-card/70">
          <div className="relative aspect-[16/9]">
            <Image
              src={selectedPrompt.example_image_url}
              alt={selectedPrompt.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 70vw"
            />
          </div>
          <CardHeader>
            <CardTitle className="font-display">{selectedPrompt.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
          </CardHeader>
          <CardContent>
            <GenerateModal prompt={selectedPrompt} triggerLabel="Start Generating" />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-xl">Pick a Prompt</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {prompts.map((prompt) => (
              <Button
                key={prompt.id}
                variant={prompt.id === selectedPrompt.id ? "default" : "outline"}
                className="justify-start"
                asChild
              >
                <Link href={`/generate?prompt=${prompt.id}`}>{prompt.title}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
