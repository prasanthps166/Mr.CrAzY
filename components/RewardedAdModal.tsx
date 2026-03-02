"use client";

import { Gift } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WatchAdButton } from "@/components/WatchAdButton";

type RewardedAdModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCredited?: (credits: number, grantedCredits: number) => void;
};

export function RewardedAdModal({ open, onOpenChange, onCredited }: RewardedAdModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Earn Credits Instantly
          </DialogTitle>
          <DialogDescription>
            Watch one rewarded ad and get 2 credits. Daily cap is 10 ad-earned credits.
          </DialogDescription>
        </DialogHeader>
        <WatchAdButton
          className="w-full"
          label="Watch Ad for 2 Credits"
          onCredited={(credits, granted) => {
            onCredited?.(credits, granted);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
