"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Compass, GalleryHorizontalEnd, Home, UserCircle2 } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/gallery", label: "Gallery", icon: GalleryHorizontalEnd },
  { href: "/generate", label: "Generate", icon: Camera },
  { href: "/community", label: "Community", icon: Compass },
  { href: "/dashboard", label: "Profile", icon: UserCircle2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-xs ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
