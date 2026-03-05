import { describe, expect, it } from "vitest";

import { buildCommunityPostsCsv, filterAndSortCommunityPosts } from "@/lib/community-feed";

const posts = [
  {
    id: "p1",
    likes: 10,
    created_at: "2026-03-05T08:00:00.000Z",
    prompt_title: "Anime Street",
    prompt_category: "Anime",
    generated_image_url: "https://img/1.jpg",
    username: "Riya",
    user_avatar_url: null,
  },
  {
    id: "p2",
    likes: 50,
    created_at: "2026-03-04T08:00:00.000Z",
    prompt_title: "Vintage Film",
    prompt_category: "Vintage",
    generated_image_url: "https://img/2.jpg",
    username: "Arjun",
    user_avatar_url: null,
  },
] as const;

describe("filterAndSortCommunityPosts", () => {
  it("filters by search query", () => {
    const result = filterAndSortCommunityPosts(posts, {
      search: "riya",
      sort: "latest",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("p1");
  });

  it("sorts by likes when requested", () => {
    const result = filterAndSortCommunityPosts(posts, {
      search: "",
      sort: "most_liked",
    });

    expect(result.map((post) => post.id)).toEqual(["p2", "p1"]);
  });
});

describe("buildCommunityPostsCsv", () => {
  it("creates exportable csv", () => {
    const csv = buildCommunityPostsCsv(posts);

    expect(csv).toContain("post_id,created_at,prompt_title,prompt_category,username,likes,generated_image_url");
    expect(csv).toContain("p1");
    expect(csv.endsWith("\n")).toBe(true);
  });
});
