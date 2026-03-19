import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Prompt } from "@/types";

type PromptCardProps = {
  prompt: Prompt;
};

export function PromptCard({ prompt }: PromptCardProps) {
  const isTrending = prompt.use_count >= 200;

  return (
    <Link href={`/gallery/${prompt.id}`} className="group block break-inside-avoid">
      <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-card/75 shadow-[0_22px_55px_-42px_rgba(52,34,21,0.72)] transition duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_28px_70px_-44px_rgba(82,49,22,0.85)]">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={prompt.example_image_url}
            alt={prompt.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120c07]/90 via-[#2d1d1033] to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
          <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
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
          <div className="absolute inset-x-4 bottom-4 z-10 rounded-[1.35rem] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/70">Signature Prompt</p>
            <p className="mt-2 line-clamp-2 font-display text-2xl leading-tight text-white">{prompt.title}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-amber-50/72">{prompt.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <Badge className="bg-primary/90 text-primary-foreground">{prompt.category}</Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#20160d]/45 px-2.5 py-1 text-xs text-white">
                <Flame className="h-3 w-3" />
                {prompt.use_count}
              </span>
            </div>
          </div>
        </div>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Built To Transform</p>
            <p className="mt-1 text-sm text-foreground">Use this style for cleaner, more polished image direction.</p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-transform group-hover:translate-x-0.5">
            View
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
