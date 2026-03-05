import { describe, expect, it } from "vitest";

import { rankRecommendedPrompts, rankRelatedPrompts, scorePromptCandidate } from "@/lib/recommendations";
import { Prompt } from "@/types";

const nowIso = new Date().toISOString();

function prompt(overrides: Partial<Prompt> & Pick<Prompt, "id" | "title" | "category">): Prompt {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? "desc",
    prompt_text: overrides.prompt_text ?? "text",
    category: overrides.category,
    example_image_url: overrides.example_image_url ?? "https://img/test.jpg",
    tags: overrides.tags ?? [],
    is_featured: overrides.is_featured ?? false,
    use_count: overrides.use_count ?? 0,
    created_at: overrides.created_at ?? nowIso,
    is_sponsored: false,
    sponsor_name: null,
    sponsor_logo_url: null,
  };
}

describe("scorePromptCandidate", () => {
  it("gives higher score when category and tags match profile", () => {
    const sourcePrompts = [
      prompt({ id: "source-1", title: "Anime Hero", category: "Anime", tags: ["cinematic", "hero"] }),
    ];
    const signals = new Map([["source-1", 5]]);

    const match = prompt({
      id: "match",
      title: "Anime Street",
      category: "Anime",
      tags: ["hero"],
      use_count: 10,
    });
    const mismatch = prompt({
      id: "mismatch",
      title: "Product Shot",
      category: "Product",
      tags: ["studio"],
      use_count: 10,
    });

    const matchScore = scorePromptCandidate(match, {
      categoryScores: new Map([["anime", 10]]),
      tagScores: new Map([["hero", 5]]),
    });
    const mismatchScore = scorePromptCandidate(mismatch, {
      categoryScores: new Map([["anime", 10]]),
      tagScores: new Map([["hero", 5]]),
    });

    expect(matchScore).toBeGreaterThan(mismatchScore);
    expect(sourcePrompts.length).toBe(1);
    expect(signals.get("source-1")).toBe(5);
  });
});

describe("rankRecommendedPrompts", () => {
  it("ranks and excludes source prompts", () => {
    const sourcePrompts = [
      prompt({ id: "source-1", title: "Vintage Portrait", category: "Vintage", tags: ["grain"] }),
    ];

    const candidates = [
      prompt({ id: "source-1", title: "Vintage Portrait", category: "Vintage", tags: ["grain"] }),
      prompt({ id: "cand-1", title: "Vintage Film", category: "Vintage", tags: ["grain"], use_count: 40 }),
      prompt({ id: "cand-2", title: "Modern Product", category: "Product", tags: ["clean"], use_count: 100 }),
    ];

    const ranked = rankRecommendedPrompts({
      sourcePrompts,
      candidates,
      signals: new Map([["source-1", 4]]),
      limit: 2,
    });

    expect(ranked.map((item) => item.id)).toEqual(["cand-1", "cand-2"]);
    expect(ranked.find((item) => item.id === "source-1")).toBeUndefined();
  });
});
describe("rankRelatedPrompts", () => {
  it("prioritizes same-category prompts with overlapping tags and excludes the source", () => {
    const source = prompt({
      id: "source-2",
      title: "Neon Portrait",
      category: "Portrait",
      tags: ["neon", "dramatic", "cinematic"],
    });

    const candidates = [
      source,
      prompt({
        id: "rel-1",
        title: "Cinematic Neon Look",
        category: "Portrait",
        tags: ["neon", "cinematic"],
        use_count: 30,
      }),
      prompt({
        id: "rel-2",
        title: "Studio Headshot",
        category: "Portrait",
        tags: ["studio"],
        use_count: 80,
      }),
      prompt({
        id: "rel-3",
        title: "Neon Street Product",
        category: "Product",
        tags: ["neon"],
        use_count: 200,
      }),
    ];

    const ranked = rankRelatedPrompts({
      sourcePrompt: source,
      candidates,
      limit: 3,
    });

    expect(ranked.map((item) => item.id)).toEqual(["rel-1", "rel-2", "rel-3"]);
    expect(ranked.find((item) => item.id === source.id)).toBeUndefined();
  });
});
