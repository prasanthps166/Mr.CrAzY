"use client";

import Image from "next/image";
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
    <Card className="mb-4 break-inside-avoid overflow-hidden border-border/60 bg-card/70">
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
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="line-clamp-1 text-sm font-semibold">{post.prompt_title}</p>
          <Badge variant="secondary">{post.prompt_category}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>by {post.username}</span>
          <div className="flex items-center gap-2">
            {canFollow ? (
              <Button
                size="sm"
                variant={isFollowing ? "secondary" : "outline"}
                className="h-8"
                onClick={onFollow}
                disabled={followingLoading}
              >
                {followingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {isFollowing ? "Following" : "Follow"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              disabled={!enableLikes}
              onClick={onLike}
            >
              <Heart className="h-4 w-4" />
              {likes}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enableLikes ? <CommunityCommentsDialog postId={post.id} /> : null}
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
