import { CommunityPostView } from "@/types";

export type CommunityFeedSort = "latest" | "most_liked";

export type CommunityFeedFilters = {
  search: string;
  sort: CommunityFeedSort;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!text.includes(",") && !text.includes('"') && !text.includes("\n")) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function filterAndSortCommunityPosts(
  posts: CommunityPostView[],
  filters: CommunityFeedFilters,
) {
  const normalizedSearch = normalize(filters.search);

  return [...posts]
    .filter((post) => {
      if (!normalizedSearch) return true;
      const haystack = normalize(
        `${post.prompt_title} ${post.prompt_category} ${post.username}`,
      );
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (filters.sort === "most_liked") {
        if (b.likes !== a.likes) return b.likes - a.likes;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function buildCommunityPostsCsv(posts: CommunityPostView[]) {
  const headers = [
    "post_id",
    "created_at",
    "prompt_title",
    "prompt_category",
    "username",
    "likes",
    "generated_image_url",
  ];

  const rows = posts.map((post) => [
    post.id,
    post.created_at,
    post.prompt_title,
    post.prompt_category,
    post.username,
    post.likes,
    post.generated_image_url,
  ]);

  const csvRows = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  return `${csvRows}\n`;
}
