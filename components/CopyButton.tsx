"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Prompt copied");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Unable to copy prompt");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onCopy}>
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

