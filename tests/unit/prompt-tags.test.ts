import { describe, expect, it } from "vitest";

import { buildPromptTagCloud, matchesPromptTag, normalizePromptTag } from "@/lib/prompt-tags";

describe("normalizePromptTag", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizePromptTag("  Neon  ")).toBe("neon");
    expect(normalizePromptTag("")).toBe("");
  });
});

describe("matchesPromptTag", () => {
  it("matches exact tag ignoring case and spacing", () => {
    const prompt = { tags: ["Neon", "Cinematic", "portrait"] };

    expect(matchesPromptTag(prompt, " neon ")).toBe(true);
    expect(matchesPromptTag(prompt, "cinematic")).toBe(true);
    expect(matchesPromptTag(prompt, "anime")).toBe(false);
  });
});

describe("buildPromptTagCloud", () => {
  it("returns top tags sorted by frequency", () => {
    const prompts = [
      { tags: ["neon", "portrait"] },
      { tags: ["NEON", "cinematic"] },
      { tags: ["portrait", "studio"] },
      { tags: ["neon"] },
    ];

    expect(buildPromptTagCloud(prompts, 3)).toEqual([
      { tag: "neon", count: 3 },
      { tag: "portrait", count: 2 },
      { tag: "cinematic", count: 1 },
    ]);
  });
});