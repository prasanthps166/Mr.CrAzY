import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type CreditBadgeProps = {
  credits: number | null;
  isPro: boolean;
};

export function CreditBadge({ credits, isPro }: CreditBadgeProps) {
  if (isPro) {
    return (
      <Badge className="gap-1 border-emerald-600/25 bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/18">
        <Sparkles className="h-3 w-3" />
        Pro Unlimited
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="border border-border/70">
      {credits ?? 0} credits
    </Badge>
  );
}
