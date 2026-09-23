"use client";

import * as React from "react";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, GraduationCap } from "lucide-react";

export interface AppHeaderProps {
  examName?: string;
  showExamSelector?: boolean;
}

export function AppHeader({
  examName = "NEET 2026",
  showExamSelector = true,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/app/home"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-subtle">
              {BRAND.logo.mark}
            </div>
            <span className="font-bold tracking-tight text-foreground text-base hidden sm:inline-block">
              {BRAND.name}
            </span>
          </Link>

          {showExamSelector && (
            <Link
              href="/exam/select"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Change active exam target"
            >
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              <span>{examName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden md:inline-flex text-[11px] font-normal text-muted-foreground">
            Foundation v0.1
          </Badge>
          <ThemeToggle />
          <Link
            href="/auth/sign-in"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
