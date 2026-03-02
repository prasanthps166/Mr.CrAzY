import Image from "next/image";
import Link from "next/link";
import { Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Prompt } from "@/types";

type PromptCardProps = {
  prompt: Prompt;
};

export function PromptCard({ prompt }: PromptCardProps) {
  const isTrending = prompt.use_count >= 200;

  return (
    <Link href={`/gallery/${prompt.id}`} prefetch={false} className="group block break-inside-avoid">
      <Card className="overflow-hidden border-border/60 bg-card/60 transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={prompt.example_image_url}
            alt={prompt.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2d1d10]/75 via-[#4a34231f] to-transparent opacity-70 transition-opacity group-hover:opacity-90" />
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            {isTrending ? (
              <Badge className="border-rose-300/20 bg-rose-500/85 text-rose-50 hover:bg-rose-500/85">
                Trending
              </Badge>
            ) : null}
            {prompt.is_sponsored ? (
              <Badge variant="secondary" className="bg-[#20160d]/55 text-amber-50 hover:bg-[#20160d]/55">
                Sponsored
              </Badge>
            ) : null}
          </div>
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <p className="line-clamp-2 text-sm font-semibold text-white">{prompt.title}</p>
            <div className="mt-2 flex items-center justify-between">
              <Badge className="bg-primary/90 text-primary-foreground">{prompt.category}</Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#20160d]/50 px-2 py-1 text-xs text-white">
                <Flame className="h-3 w-3" />
                {prompt.use_count}
              </span>
            </div>
          </div>
        </div>
        <CardContent className="pt-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">{prompt.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
