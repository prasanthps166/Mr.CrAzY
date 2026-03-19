"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Share2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { AdBanner } from "@/components/AdBanner";
import { ImageUploader } from "@/components/ImageUploader";
import { RewardedAdModal } from "@/components/RewardedAdModal";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { GENERATE_MESSAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Prompt } from "@/types";

type GenerateModalProps = {
  prompt: Pick<Prompt, "id" | "title" | "example_image_url">;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  onGenerated?: (generatedUrl: string) => void;
};

type GenerationResult = {
  generatedImageUrl: string;
  generationId: string | null;
  isPro: boolean;
};

export function GenerateModal({
  prompt,
  triggerLabel = "Use This Prompt",
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  onGenerated,
}: GenerateModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [strength, setStrength] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [trialConsumed, setTrialConsumed] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [rewardedModalOpen, setRewardedModalOpen] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setMessageIndex((index) => (index + 1) % GENERATE_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  function resetFlow() {
    setFile(null);
    setResult(null);
    setStrength(0.7);
    setTrialConsumed(false);
    setNeedsCredits(false);
    setRewardedModalOpen(false);
  }

  async function getAccessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function generate() {
    if (!file) {
      toast.error("Upload a photo first");
      return;
    }

    setNeedsCredits(false);
    setIsGenerating(true);
    setMessageIndex(0);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("promptId", prompt.id);
      formData.append("strength", String(strength));
      formData.append("file", file);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.requiresSignup) {
          setTrialConsumed(true);
        }
        if (response.status === 402) {
          setNeedsCredits(true);
          setRewardedModalOpen(true);
        }
        throw new Error(payload.message || "Generation failed");
      }

      setResult({
        generatedImageUrl: payload.generatedImageUrl,
        generationId: payload.generationId ?? null,
        isPro: Boolean(payload.isPro),
      });
      onGenerated?.(payload.generatedImageUrl);
      toast.success("Image generated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function shareToCommunity() {
    if (!result?.generationId) {
      toast.error("Only signed-in generations can be shared");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Please login to share");
      return;
    }

    const response = await fetch("/api/community/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ generationId: result.generationId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.message || "Could not share to community");
      return;
    }
    toast.success("Shared to community");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetFlow();
      }}
    >
      <DialogTrigger asChild>
        <Button className={cn("gap-2", triggerClassName)} variant={triggerVariant} size={triggerSize}>
          <WandSparkles className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate with {prompt.title}</DialogTitle>
          <DialogDescription>
            Upload your photo, set transformation strength, and generate your AI artwork.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Style reference</p>
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border/60">
                <Image
                  src={prompt.example_image_url}
                  alt={prompt.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Upload photo</p>
              <ImageUploader file={file} onFileSelect={setFile} disabled={isGenerating} />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Transformation strength</span>
              <span className="text-muted-foreground">{strength.toFixed(2)}</span>
            </div>
            <Slider
              min={0.4}
              max={0.9}
              step={0.05}
              value={[strength]}
              onValueChange={(values) => setStrength(values[0] ?? 0.7)}
              disabled={isGenerating}
            />
          </div>

          {isGenerating ? (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{GENERATE_MESSAGES[messageIndex]}</span>
              </div>
            </div>
          ) : null}

          {result && previewUrl ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Original</p>
                <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60">
                  <Image src={previewUrl} alt="Original upload" fill className="object-cover" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Generated</p>
                <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60">
                  <Image
                    src={result.generatedImageUrl}
                    alt="Generated output"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {trialConsumed ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              Guest trial already used. Create a free account to continue generating.
            </div>
          ) : null}

          {needsCredits ? (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 text-sm">
              Credits finished. Watch a rewarded ad to instantly get 2 more credits.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={isGenerating || !file} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              Generate
            </Button>
            {needsCredits ? (
              <Button variant="secondary" onClick={() => setRewardedModalOpen(true)}>
                Watch Ad for 2 Credits
              </Button>
            ) : null}
            {result ? (
              <>
                <Button variant="secondary" asChild>
                  <a href={result.generatedImageUrl} download target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
                <Button variant="outline" onClick={shareToCommunity}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share to Community
                </Button>
                <WhatsAppShareButton
                  shareText="Check out my AI transformation on PromptGallery!"
                  shareUrl={result.generatedImageUrl}
                  generationId={result.generationId}
                />
                <Button variant="outline" onClick={generate} disabled={isGenerating}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
                <Button variant="ghost" onClick={resetFlow}>
                  Try Another Prompt
                </Button>
              </>
            ) : null}
          </div>

          {result && !result.isPro ? (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
              <p>Remove watermark, unlock HD output, and disable ads with Pro (Rs 49/month).</p>
              <AdBanner placement="generate_result" />
            </div>
          ) : null}
        </div>
      </DialogContent>
      <RewardedAdModal
        open={rewardedModalOpen}
        onOpenChange={setRewardedModalOpen}
        onCredited={() => setNeedsCredits(false)}
      />
    </Dialog>
  );
}
