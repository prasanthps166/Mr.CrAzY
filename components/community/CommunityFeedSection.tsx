"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CommunityGrid } from "@/components/CommunityGrid";
import { Button } from "@/components/ui/button";
import { buildCommunityPostsCsv } from "@/lib/community-feed";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CommunityPostView } from "@/types";

type CommunityFeedSectionProps = {
  title: string;
  initialPosts: CommunityPostView[];
  initialHasMore: boolean;
  initialNextOffset: number;
  category: string;
  scope: "all" | "following";
  search: string;
  sort: "latest" | "most_liked";
  canRequestMore: boolean;
};

function mergePosts(existing: CommunityPostView[], incoming: CommunityPostView[]) {
  const map = new Map(existing.map((post) => [post.id, post]));
  for (const post of incoming) {
    map.set(post.id, post);
  }
  return Array.from(map.values());
}

export function CommunityFeedSection({
  title,
  initialPosts,
  initialHasMore,
  initialNextOffset,
  category,
  scope,
  search,
  sort,
  canRequestMore,
}: CommunityFeedSectionProps) {
  const [posts, setPosts] = useState<CommunityPostView[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loadingMore, setLoadingMore] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  async function getAccessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !canRequestMore) return;

    setLoadingMore(true);

    const params = new URLSearchParams({
      limit: "24",
      offset: String(nextOffset),
      category,
      scope,
      search,
      sort: sort === "most_liked" ? "most_liked" : "recent",
    });

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/community/feed?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        posts?: CommunityPostView[];
        hasMore?: boolean;
        nextOffset?: number;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load more posts");
      }

      const incoming = payload.posts ?? [];
      setPosts((current) => mergePosts(current, incoming));
      setHasMore(Boolean(payload.hasMore));
      setNextOffset((current) => payload.nextOffset ?? current + incoming.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  }

  function downloadCsv() {
    if (!posts.length) {
      toast.error("No posts to export");
      return;
    }

    const csv = buildCommunityPostsCsv(posts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `promptgallery-community-${scope}-${category.toLowerCase()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Showing {posts.length} result(s)</p>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!posts.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <CommunityGrid posts={posts} />

      {canRequestMore && hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load More
          </Button>
        </div>
      ) : null}
    </section>
  );
}

