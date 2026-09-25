"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, Library, MoreHorizontal, LucideIcon } from "lucide-react";
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

  // Hide mobile bottom nav during active question player sessions for distraction-free practice
  if (pathname?.includes("/app/practice/session/") && !pathname.endsWith("/result")) {
    return null;
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface shadow-subtle safe-area-bottom"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex h-16 items-center justify-around px-1">
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
                "relative flex flex-1 flex-col items-center justify-center py-1.5 min-h-[44px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg select-none",
                isActive
                  ? "text-primary font-semibold"
                  : "text-foreground-subtle hover:text-foreground active:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-1 w-7 rounded-full bg-primary"
                />
              )}
              <Icon className="h-[22px] w-[22px] mb-1" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="text-[11px] leading-none tracking-tight">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
