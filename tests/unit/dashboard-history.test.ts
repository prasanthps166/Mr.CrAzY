import { describe, expect, it } from "vitest";

import { buildDashboardHistoryCsv, filterDashboardHistory } from "@/lib/dashboard-history";

const baseItems = [
  {
    id: "gen-1",
    prompt_id: "prompt-1",
    created_at: "2026-03-04T10:00:00.000Z",
    original_image_url: "https://img/original-1.jpg",
    generated_image_url: "https://img/generated-1.jpg",
    is_public: true,
    prompt: {
      title: "Anime Rain Portrait",
      category: "Anime",
      description: "Soft anime portrait",
    },
  },
  {
    id: "gen-2",
    prompt_id: "prompt-2",
    created_at: "2026-03-01T10:00:00.000Z",
    original_image_url: "https://img/original-2.jpg",
    generated_image_url: "https://img/generated-2.jpg",
    is_public: false,
    prompt: {
      title: "Vintage Film",
      category: "Vintage",
      description: "Grainy old camera look",
    },
  },
  {
    id: "gen-3",
    prompt_id: "prompt-3",
    created_at: "2026-02-01T10:00:00.000Z",
    original_image_url: "https://img/original-3.jpg",
    generated_image_url: "https://img/generated-3.jpg",
    is_public: false,
    prompt: {
      title: "Neon City",
      category: "Cyberpunk",
      description: "Night street vibe",
    },
  },
] as const;

describe("filterDashboardHistory", () => {
  it("filters by search text and date period", () => {
    const result = filterDashboardHistory(
      baseItems,
      {
        search: "anime",
        period: "7d",
        sort: "newest",
      },
      new Date("2026-03-05T12:00:00.000Z").getTime(),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("gen-1");
  });

  it("sorts oldest first when requested", () => {
    const result = filterDashboardHistory(
      baseItems,
      {
        search: "",
        period: "all",
        sort: "oldest",
      },
      new Date("2026-03-05T12:00:00.000Z").getTime(),
    );

    expect(result.map((item) => item.id)).toEqual(["gen-3", "gen-2", "gen-1"]);
  });
});

describe("buildDashboardHistoryCsv", () => {
  it("returns csv output with escaped fields", () => {
    const csv = buildDashboardHistoryCsv([
      {
        id: "gen-csv",
        prompt_id: "prompt-csv",
        created_at: "2026-03-04T10:00:00.000Z",
        original_image_url: "https://img/original.jpg",
        generated_image_url: "https://img/generated.jpg",
        is_public: true,
        prompt: {
          title: "Portrait, \"Studio\"",
          category: "Portrait",
          description: "desc",
        },
      },
    ]);

    expect(csv).toContain("generation_id,created_at,prompt_id,prompt_title");
    expect(csv).toContain('"Portrait, ""Studio"""');
    expect(csv.endsWith("\n")).toBe(true);
  });
});
