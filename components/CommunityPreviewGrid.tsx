import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CommunityPostView } from "@/types";

type CommunityPreviewGridProps = {
  posts: CommunityPostView[];
};

export function CommunityPreviewGrid({ posts }: CommunityPreviewGridProps) {
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
        <Card key={post.id} className="mb-4 break-inside-avoid overflow-hidden border-border/60 bg-card/70">
          <div className="relative aspect-[4/5]">
            <Image
              src={post.generated_image_url}
              alt={`${post.prompt_title} by ${post.username}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="line-clamp-1 text-sm font-semibold">{post.prompt_title}</p>
              <Badge variant="secondary">{post.prompt_category}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="line-clamp-1">by {post.username}</span>
              <span>{post.likes} likes</span>
            </div>
            <Link href="/community" className="inline-block text-xs font-medium text-primary hover:underline">
              View in community
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
