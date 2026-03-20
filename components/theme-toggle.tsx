"use client";

import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
};

export function ThemeToggle({
  className,
  showLabel = false,
  variant = "ghost",
  size = "icon",
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;

  if (!mounted) {
    return (
      <Button variant={variant} size={size} aria-label="Toggle theme" disabled className={className}>
        <Sun className="h-4 w-4 opacity-0" />
        {showLabel ? <span>Theme</span> : null}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      className={className}
      onClick={() => setTheme(nextTheme)}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );
}
