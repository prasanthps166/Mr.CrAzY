"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const categories = ["Anime", "Fantasy", "Portrait", "Architecture", "Product", "Vintage", "Cartoon", "Realistic", "Art"];

export default function UploadPromptPage() {
  const [editPromptId, setEditPromptId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Anime");
  const [tags, setTags] = useState("");
  const [promptText, setPromptText] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [exampleImages, setExampleImages] = useState<File[]>([]);
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("49");
  const [submitting, setSubmitting] = useState(false);
  const coverPreviewUrl = useMemo(() => (coverImage ? URL.createObjectURL(coverImage) : null), [coverImage]);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setEditPromptId(new URLSearchParams(window.location.search).get("edit"));
  }, []);

  useEffect(() => {
    async function loadEditPrompt() {
      if (!editPromptId || !supabase) return;

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/creator/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return;

      const payload = (await response.json().catch(() => ({}))) as {
        prompts?: Array<{
          prompt: {
            id: string;
            title: string;
            description: string;
            category: string;
            tags: string[];
            prompt_text: string;
            is_free: boolean;
            price: number;
          };
        }>;
      };

      const selected = payload.prompts?.find((item) => item.prompt.id === editPromptId)?.prompt;
      if (!selected) return;

      setTitle(selected.title);
      setDescription(selected.description);
      setCategory(selected.category);
      setTags((selected.tags ?? []).join(", "));
      setPromptText(selected.prompt_text);
      setIsFree(Boolean(selected.is_free));
      setPrice(String(Number(selected.price || 0)));
    }

    void loadEditPrompt();
  }, [editPromptId, supabase]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  async function getAccessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  function nextStep() {
    setStep((current) => Math.min(5, current + 1));
  }

  function prevStep() {
    setStep((current) => Math.max(1, current - 1));
  }

  async function onSubmit() {
    const token = await getAccessToken();
    if (!token) {
      toast.error("Login required");
      return;
    }

    if (!title.trim() || !description.trim() || !promptText.trim()) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (!editPromptId && !coverImage) {
      toast.error("Cover image is required.");
      return;
    }

    if (!isFree) {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 19 || numericPrice > 499) {
        toast.error("Paid prompts must be priced between ₹19 and ₹499.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (editPromptId) {
        const response = await fetch("/api/creator/prompt/manage", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: editPromptId,
            title,
            description,
            category,
            tags: tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            prompt_text: promptText,
            is_free: isFree,
            price: isFree ? 0 : Number(price),
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to update prompt");
        }

        toast.success("Prompt updated");
        setSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("tags", tags);
      formData.append("prompt_text", promptText);
      formData.append("is_free", String(isFree));
      formData.append("price", isFree ? "0" : price);
      if (coverImage) {
        formData.append("cover_image", coverImage);
      }
      exampleImages.forEach((file) => {
        formData.append("example_images", file);
      });

      const response = await fetch("/api/creator/prompt/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to submit prompt");
      }

      toast.success("Submitted for review");
      window.location.href = "/creator";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {editPromptId ? "Edit Prompt" : "Upload New Prompt"}
        </h1>
        <p className="text-muted-foreground">Step {step} of 5</p>
      </div>

      <Card className="border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle>
            {step === 1 && "Step 1: Basic Info"}
            {step === 2 && "Step 2: The Prompt"}
            {step === 3 && "Step 3: Examples"}
            {step === 4 && "Step 4: Pricing"}
            {step === 5 && "Step 5: Preview & Submit"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <div className="space-y-4">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prompt title" />
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description"
                rows={4}
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Tags (comma separated)"
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <Textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="Write your prompt text here..."
                rows={12}
              />
              <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                Tips: be explicit about style, lighting, composition, constraints, and negative prompts.
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {!editPromptId ? (
                <label className="space-y-2 text-sm">
                  <span>Cover image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setCoverImage(event.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Editing does not replace stored images. Create a new prompt if you need new media assets.
                </p>
              )}

              {!editPromptId ? (
                <label className="space-y-2 text-sm">
                  <span>Additional examples (up to 4)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setExampleImages(Array.from(event.target.files ?? []).slice(0, 4))}
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              ) : null}

              {coverPreviewUrl ? (
                <div className="relative h-52 overflow-hidden rounded-lg border border-border/60">
                  <Image
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
                Make this prompt free
              </label>
              {!isFree ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0.99"
                  max="499"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="Price in USD"
                />
              ) : (
                <p className="text-sm text-muted-foreground">This prompt will be listed as Free.</p>
              )}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Title:</span> {title}
              </p>
              <p>
                <span className="text-muted-foreground">Category:</span> {category}
              </p>
              <p>
                <span className="text-muted-foreground">Tags:</span> {tags || "None"}
              </p>
              <p>
                <span className="text-muted-foreground">Pricing:</span> {isFree ? "Free" : `₹${Number(price || 0).toFixed(2)}`}
              </p>
              <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                <p className="mb-1 text-muted-foreground">Prompt text preview</p>
                <pre className="whitespace-pre-wrap text-sm">{promptText || "(empty)"}</pre>
              </div>
              <p className="text-xs text-muted-foreground">
                On submit, your prompt is set to <strong>pending_review</strong> and sent for admin review.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={prevStep} disabled={step === 1 || submitting}>
              Back
            </Button>
            {step < 5 ? (
              <Button onClick={nextStep} disabled={submitting}>
                Continue
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editPromptId ? "Save Changes" : "Submit for Review"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-muted-foreground">
        Need payouts setup first? <Link href="/creator/signup" className="text-primary hover:underline">Open creator signup</Link>
      </div>
    </div>
  );
}
