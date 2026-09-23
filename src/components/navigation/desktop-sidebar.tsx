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
      className="hidden md:flex h-screen w-64 flex-col border-r border-border bg-surface shrink-0 sticky top-0"
      aria-label="Desktop Navigation"
    >
      <div className="flex h-14 items-center border-b border-border px-6 gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-subtle">
          {BRAND.logo.mark}
        </div>
        <span className="font-bold tracking-tight text-foreground text-base">
          {BRAND.name}
        </span>
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
                  ? "bg-primary text-primary-foreground shadow-subtle"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{BRAND.name}</p>
        <p className="text-[11px] mt-0.5">Phase 1 Foundation</p>
      </div>
    </aside>
  );
}
