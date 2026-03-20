"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CommunityCommentsDialog } from "@/components/CommunityCommentsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CommunityPostView } from "@/types";

type CommunityGridProps = {
  posts: CommunityPostView[];
  enableLikes?: boolean;
};

function CommunityItem({
  post,
  likes,
  onLike,
  canFollow,
  isFollowing,
  onFollow,
  followingLoading,
  enableLikes,
}: {
  post: CommunityPostView;
  likes: number;
  onLike: () => Promise<void>;
  canFollow: boolean;
  isFollowing: boolean;
  onFollow: () => Promise<void>;
  followingLoading: boolean;
  enableLikes: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Card className="mb-4 break-inside-avoid overflow-hidden rounded-[1.75rem] border-border/60 bg-card/78 shadow-[0_22px_55px_-42px_rgba(52,34,21,0.72)]">
      <div className="relative aspect-[4/5]">
        {!loaded && <Skeleton className="absolute inset-0" />}
        <Image
          src={post.generated_image_url}
          alt={`${post.prompt_title} by ${post.username}`}
          fill
          className={`object-cover transition ${loaded ? "opacity-100" : "opacity-0"}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onLoad={() => setLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120c07]/80 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-[#20160d]/55 text-amber-50 hover:bg-[#20160d]/55">
            {post.prompt_category}
          </Badge>
          <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-50/88">
            {post.username}
          </span>
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <div className="rounded-[1.25rem] border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/72">Community Pick</p>
            <p className="mt-1 line-clamp-2 font-display text-2xl leading-tight text-white">{post.prompt_title}</p>
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="line-clamp-1">Shared by {post.username}</span>
          <span>{likes} likes</span>
        </div>
        {post.prompt_id || canFollow ? (
          <div className="flex items-center gap-2">
            {post.prompt_id ? (
              <Button variant="outline" className={canFollow ? "flex-1" : "w-full"} asChild>
                <Link href={`/gallery/${post.prompt_id}`}>Open Prompt</Link>
              </Button>
            ) : null}
            {canFollow ? (
              <Button
                size="sm"
                variant={isFollowing ? "secondary" : "outline"}
                className="h-9 rounded-full"
                onClick={onFollow}
                disabled={followingLoading}
              >
                {followingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {isFollowing ? "Following" : "Follow"}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          {enableLikes ? <CommunityCommentsDialog postId={post.id} /> : null}
          {enableLikes ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full gap-1"
              disabled={!enableLikes}
              onClick={onLike}
            >
              <Heart className="h-4 w-4" />
              {likes}
            </Button>
          ) : null}
          <WhatsAppShareButton
            className={enableLikes ? "flex-1" : "w-full"}
            shareText={`Check out this ${post.prompt_title} transformation on PromptGallery!`}
            shareUrl={post.generated_image_url}
            generationId={null}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function CommunityGrid({ posts, enableLikes = true }: CommunityGridProps) {
  const [likesMap, setLikesMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(posts.map((post) => [post.id, post.likes])),
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followLoadingUserId, setFollowLoadingUserId] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (!enableLikes) return null;
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, [enableLikes]);

  useEffect(() => {
    if (!enableLikes || !supabase) return;
    const client = supabase;
    let active = true;

    async function loadFollowState() {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id ?? null;
      if (!active) return;

      setCurrentUserId(userId);

      if (!token) {
        setFollowingMap({});
        return;
      }

      const response = await fetch("/api/community/follow", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        setFollowingMap({});
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { followingUserIds?: string[] };
      if (!active) return;

      setFollowingMap(
        Object.fromEntries((payload.followingUserIds ?? []).map((followedUserId) => [followedUserId, true])),
      );
    }

    void loadFollowState();

    return () => {
      active = false;
    };
  }, [enableLikes, supabase]);

  async function getAccessToken() {
    const client = supabase;
    if (!client) return null;
    const { data } = await client.auth.getSession();
    setCurrentUserId(data.session?.user?.id ?? null);
    return data.session?.access_token ?? null;
  }

  async function handleLike(postId: string) {
    if (!enableLikes) return;
    const previous = likesMap[postId] ?? 0;
    setLikesMap((current) => ({ ...current, [postId]: previous + 1 }));

    const token = (await getAccessToken()) ?? undefined;

    const response = await fetch("/api/community/like", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ postId }),
    });

    if (!response.ok) {
      setLikesMap((current) => ({ ...current, [postId]: previous }));
      const payload = await response.json().catch(() => ({ message: "Could not like this post" }));
      toast.error(payload.message || "Could not like this post");
      return;
    }

    const payload = await response.json();
    setLikesMap((current) => ({ ...current, [postId]: payload.likes ?? previous + 1 }));
  }

  async function handleFollow(targetUserId: string | undefined) {
    if (!enableLikes || !targetUserId) return;

    const token = await getAccessToken();
    if (!token) {
      toast.error("Login to follow creators");
      return;
    }

    const isFollowing = Boolean(followingMap[targetUserId]);
    setFollowLoadingUserId(targetUserId);

    const response = await fetch("/api/community/follow", {
      method: isFollowing ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    const payload = await response.json().catch(() => ({}));
    setFollowLoadingUserId(null);

    if (!response.ok) {
      toast.error(payload.message || "Could not update follow status");
      return;
    }

    setFollowingMap((current) => ({ ...current, [targetUserId]: !isFollowing }));
  }

  if (!posts.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        No community posts yet.
      </div>
    );
  }

  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {posts.map((post) => (
        <CommunityItem
          key={post.id}
          post={post}
          likes={likesMap[post.id] ?? post.likes}
          onLike={() => handleLike(post.id)}
          canFollow={Boolean(enableLikes && post.user_id && post.user_id !== currentUserId)}
          isFollowing={Boolean(post.user_id && followingMap[post.user_id])}
          onFollow={() => handleFollow(post.user_id)}
          followingLoading={Boolean(post.user_id && followLoadingUserId === post.user_id)}
          enableLikes={enableLikes}
        />
      ))}
    </div>
  );
}
