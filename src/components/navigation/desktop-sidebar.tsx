"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Calendar,
  FileCheck2,
  BarChart2,
  Library,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";
import { DESKTOP_NAV_ITEMS } from "@/config/navigation";
import { BRAND } from "@/config/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils/cn";

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  BookOpen,
  Calendar,
  FileCheck2,
  BarChart2,
  Library,
  MoreHorizontal,
};

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex h-screen w-64 flex-col border-r border-border-subtle bg-surface shrink-0 sticky top-0"
      aria-label="Desktop Navigation"
    >
      <div className="flex h-16 items-center border-b border-border-subtle px-5 gap-2.5">
        <BrandMark size={32} />
        <span className="font-bold tracking-tight text-foreground text-base">{BRAND.name}</span>
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Main Navigation">
        {DESKTOP_NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] || Home;
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/home" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-surface-tint text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{BRAND.name}</p>
        <p className="text-[11px] mt-0.5 text-foreground-subtle">{BRAND.tagline}</p>
      </div>
    </aside>
  );
}
