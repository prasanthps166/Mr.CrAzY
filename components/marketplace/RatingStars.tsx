import { Star } from "lucide-react";

export function RatingStars({
  rating,
  count,
  size = "sm",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index < rounded;
          return (
            <Star
              key={index}
              className={`${iconSize} ${
                active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)}
        {typeof count === "number" ? ` (${count})` : ""}
      </span>
    </div>
  );
}
