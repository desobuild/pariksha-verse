"use client";

import * as React from "react";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, UserCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { resolveActiveExamAttempt } from "@/domain";
import { getExamAttempt } from "@/domain/exam-catalog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

export interface AppHeaderProps {
  examName?: string;
  showExamSelector?: boolean;
}

export function AppHeader({ examName, showExamSelector = true }: AppHeaderProps) {
  const { identity, user, signOut, isMigrating } = useAuth();
  const isAuthenticated = identity?.type === "authenticated";
  const { workspace } = useActiveWorkspace();
  // Prefer the active workspace's attempt; fall back to the canonical attempt
  const activeAttempt = React.useMemo(
    () =>
      workspace
        ? getExamAttempt(workspace.examAttemptId) ?? resolveActiveExamAttempt()
        : resolveActiveExamAttempt(),
    [workspace]
  );
  const displayedExamName = examName || activeAttempt.label;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface shadow-subtle">
      <div className="flex h-16 items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/app/home"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg shrink-0"
          >
            <BrandMark size={32} />
            <span className="font-bold tracking-tight text-foreground text-base hidden sm:inline-block">
              {BRAND.name}
            </span>
          </Link>

          {showExamSelector && (
            <Link
              href="/exam/select"
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink min-w-0"
              title={
                activeAttempt.isProvisional && activeAttempt.provisionalNotice
                  ? `Change active exam target (${activeAttempt.label} is provisional: ${activeAttempt.provisionalNotice})`
                  : "Change active exam target"
              }
            >
              <span className="truncate max-w-[70px] sm:max-w-none">{displayedExamName}</span>
              <ChevronDown className="h-3 w-3 opacity-80 shrink-0" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isMigrating && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-normal text-muted-foreground shrink min-w-0"
              >
                <UserCheck className="h-3 w-3 text-primary shrink-0" />
                <span className="max-w-[75px] sm:max-w-[140px] truncate">{user?.email}</span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="h-8 text-xs font-semibold shrink-0"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge
                variant="primary"
                className="inline-flex text-[10px] sm:text-[11px] font-medium"
              >
                Guest Mode
              </Badge>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
                <Link href="/auth/sign-in">Sign In</Link>
              </Button>
            </div>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
