import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { primaryNavItems, secondaryNavItems } from "@/components/navbar/config";

const NavbarClientShell = dynamic(
  () => import("@/components/navbar/NavbarClientShell").then((module) => module.NavbarClientShell),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="hidden items-center gap-2 md:flex">
          <div className="h-8 w-20 rounded-full border border-border/60 bg-background/70" />
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
          <Button asChild>
            <Link href="/generate">Generate</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
        </div>
      </>
    ),
  },
);

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <div className="rounded-full border border-primary/20 bg-primary/12 p-2">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>PromptGallery</span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground lg:block">
                Creator-Built Prompt Looks
              </span>
            </div>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-5 md:flex">
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex items-center gap-4">
              {secondaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <NavbarClientShell />
      </div>
    </header>
  );
}
