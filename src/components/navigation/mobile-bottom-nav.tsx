"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  BarChart2,
  Library,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";
import { MOBILE_NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  BookOpen,
  BarChart2,
  Library,
  MoreHorizontal,
};

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 safe-area-bottom"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] || Home;
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/home" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-1 min-h-[44px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", isActive && "stroke-[2.5px]")} />
              <span className="text-[11px] leading-tight">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
