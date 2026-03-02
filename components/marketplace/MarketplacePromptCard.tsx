import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { RatingStars } from "@/components/marketplace/RatingStars";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplacePromptWithCreator } from "@/types";

export function MarketplacePromptCard({ prompt }: { prompt: MarketplacePromptWithCreator }) {
  const resolvedPrice = Number(prompt.price_inr ?? prompt.price ?? 0);
  const priceLabel = prompt.is_free ? "Free" : `\u20b9${resolvedPrice.toFixed(2)}`;
  const creatorName = prompt.creator?.display_name || "Community Creator";

  return (
    <Link href={`/marketplace/${prompt.id}`} className="group block">
      <Card className="h-full overflow-hidden border-border/60 bg-card/70 transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={prompt.cover_image_url}
            alt={prompt.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 30vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2d1d10]/75 via-[#4a34231f] to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge
              className={
                prompt.is_free
                  ? "border-emerald-500/35 bg-emerald-500/85 text-emerald-50"
                  : "border-primary/35 bg-primary/90 text-primary-foreground"
              }
            >
              {priceLabel}
            </Badge>
            <Badge variant="secondary" className="bg-[#20160d]/50 text-amber-50">
              {prompt.category}
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <p className="line-clamp-2 text-sm font-semibold text-white">{prompt.title}</p>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            {prompt.creator?.avatar_url ? (
              <Image
                src={prompt.creator.avatar_url}
                alt={creatorName}
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {creatorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="line-clamp-1 text-xs text-muted-foreground">{creatorName}</span>
          </div>

          <RatingStars rating={Number(prompt.rating_avg) || 0} count={prompt.rating_count} />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              {prompt.purchase_count} purchases
            </span>
            <span>{new Date(prompt.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
