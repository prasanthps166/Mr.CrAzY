"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

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
  enableLikes,
}: {
  post: CommunityPostView;
  likes: number;
  onLike: () => Promise<void>;
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
        <WhatsAppShareButton
          className="w-full"
          shareText={`Check out this ${post.prompt_title} transformation on PromptGallery!`}
          shareUrl={post.generated_image_url}
          generationId={null}
        />
      </CardContent>
    </Card>
  );
}

export function CommunityGrid({ posts, enableLikes = true }: CommunityGridProps) {
  const [likesMap, setLikesMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(posts.map((post) => [post.id, post.likes])),
  );

  const supabase = useMemo(() => {
    if (!enableLikes) return null;
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, [enableLikes]);

  async function handleLike(postId: string) {
    if (!enableLikes) return;
    const previous = likesMap[postId] ?? 0;
    setLikesMap((current) => ({ ...current, [postId]: previous + 1 }));

    let token: string | undefined;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    }

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
          enableLikes={enableLikes}
        />
      ))}
    </div>
  );
}
