"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PromptCard } from "@/components/PromptCard";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { Prompt } from "@/types";

type RecommendedPromptsSectionProps = {
  title: string;
  description?: string;
  limit?: number;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
};

type RecommendedPromptsResponse = {
  prompts?: Prompt[];
};

export function RecommendedPromptsSection({
  title,
  description,
  limit = 6,
  linkHref,
  linkLabel,
  className,
}: RecommendedPromptsSectionProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [resolved, setResolved] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setResolved(true);
      return;
    }

    const client = supabase;
    let active = true;

    async function load(accessToken: string | null) {
      if (!accessToken) {
        if (!active) return;
        setPrompts([]);
        setResolved(true);
        return;
      }

      const response = await fetch(`/api/prompts/recommended?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!active) return;

      if (!response.ok) {
        setPrompts([]);
        setResolved(true);
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as RecommendedPromptsResponse;
      if (!active) return;

      setPrompts(payload.prompts ?? []);
      setResolved(true);
    }

    async function hydrateFromSession() {
      const { data } = await client.auth.getSession();
      await load(data.session?.access_token ?? null);
    }

    void hydrateFromSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void load(session?.access_token ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [limit, supabase]);

  if (!resolved || !prompts.length) {
    return null;
  }

  return (
    <section className={className}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        {linkHref && linkLabel ? (
          <Button variant="ghost" asChild>
            <Link href={linkHref}>{linkLabel}</Link>
          </Button>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <PromptCard key={`recommended-${prompt.id}`} prompt={prompt} />
        ))}
      </div>
    </section>
  );
}