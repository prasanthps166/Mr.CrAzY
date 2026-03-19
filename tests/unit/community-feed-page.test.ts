import { describe, expect, it } from "vitest";

import { shouldIncludeCommunityView } from "@/lib/community-feed-page";

const basePost = {
  prompt_title: "Anime Street",
  prompt_category: "Anime",
  username: "Riya",
} as const;

describe("shouldIncludeCommunityView", () => {
  it("filters out prompts outside the selected category prompt set", () => {
    const result = shouldIncludeCommunityView(basePost, {
      normalizedSearch: "",
      promptId: "prompt-2",
      userId: "user-1",
      categoryPromptIds: new Set(["prompt-1"]),
    });

    expect(result).toBe(false);
  });

  it("includes a post when the prompt matches the searched prompt set", () => {
    const result = shouldIncludeCommunityView(basePost, {
      normalizedSearch: "anime",
      promptId: "prompt-1",
      userId: "user-9",
      searchPromptIds: new Set(["prompt-1"]),
      searchUserIds: new Set(),
    });

    expect(result).toBe(true);
  });

  it("includes a post when the creator matches the searched user set", () => {
    const result = shouldIncludeCommunityView(basePost, {
      normalizedSearch: "riya",
      promptId: "prompt-9",
      userId: "user-1",
      searchPromptIds: new Set(),
      searchUserIds: new Set(["user-1"]),
    });

    expect(result).toBe(true);
  });

  it("falls back to text matching when no preloaded search sets are available", () => {
    const result = shouldIncludeCommunityView(basePost, {
      normalizedSearch: "street",
      promptId: "prompt-9",
      userId: "user-9",
    });

    expect(result).toBe(true);
  });

  it("rejects posts that do not match search through prompt, user, or text", () => {
    const result = shouldIncludeCommunityView(basePost, {
      normalizedSearch: "vintage",
      promptId: "prompt-9",
      userId: "user-9",
      searchPromptIds: new Set(),
      searchUserIds: new Set(),
    });

    expect(result).toBe(false);
  });
});
