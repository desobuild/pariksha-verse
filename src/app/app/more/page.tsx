"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  GraduationCap,
  Info,
  LogOut,
  Palette,
  Shield,
} from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth/use-auth";
import { resolveActiveExamAttempt } from "@/domain";
import { getExamAttempt } from "@/domain/exam-catalog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

function ListRow({
  icon,
  label,
  hint,
  control,
  asLink,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  control?: React.ReactNode;
  asLink?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-tint text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-foreground-subtle">{hint}</span>}
      </span>
      {control ?? (asLink ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null)}
    </>
  );

  const classes =
    "flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

  if (asLink && href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}

export default function MorePage() {
  const { identity, user, signOut } = useAuth();
  const { workspace } = useActiveWorkspace();
  const isAuthenticated = identity?.type === "authenticated";
  const activeAttempt = React.useMemo(
    () =>
      workspace
        ? getExamAttempt(workspace.examAttemptId) ?? resolveActiveExamAttempt()
        : resolveActiveExamAttempt(),
    [workspace]
  );
  const displayName = isAuthenticated ? user?.email?.split("@")[0] : "Guest learner";
  const initial = (displayName || "P").charAt(0).toUpperCase();

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="type-h1">More</h1>
        <p className="mt-1 type-body text-muted-foreground">
          Workspace, preferences, and account controls.
        </p>
      </div>

      {/* Profile card */}
      <Card className="mb-6 p-5">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold capitalize text-foreground">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-foreground-subtle">
              {isAuthenticated ? user?.email : "Preparing locally on this device"}
            </p>
          </div>
          {!isAuthenticated && <Badge variant="primary">Guest Mode</Badge>}
        </div>
      </Card>

      {/* Workspace */}
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
        Workspace
      </p>
      <Card className="mb-6 divide-y divide-border-subtle overflow-hidden">
        <ListRow
          icon={<GraduationCap className="h-[18px] w-[18px]" />}
          label={activeAttempt.label}
          hint="Active preparation"
          asLink
          href="/exam/select"
        />
      </Card>

      {/* Preferences */}
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
        Preferences
      </p>
      <Card className="mb-6 divide-y divide-border-subtle overflow-hidden">
        <ListRow
          icon={<Palette className="h-[18px] w-[18px]" />}
          label="Appearance"
          hint="Light, dark, or system"
          control={<ThemeToggle />}
        />
      </Card>

      {/* About & legal */}
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
        About &amp; Legal
      </p>
      <Card className="mb-6 divide-y divide-border-subtle overflow-hidden">
        <ListRow
          icon={<Info className="h-[18px] w-[18px]" />}
          label={`About ${BRAND.name}`}
          hint={BRAND.tagline}
        />
        <ListRow
          icon={<FileText className="h-[18px] w-[18px]" />}
          label="Terms of Service"
          asLink
          href={BRAND.links.terms}
        />
        <ListRow
          icon={<Shield className="h-[18px] w-[18px]" />}
          label="Privacy Policy"
          asLink
          href={BRAND.links.privacy}
        />
      </Card>

      {/* Account action */}
      {isAuthenticated ? (
        <Button
          variant="outline"
          size="lg"
          className="w-full font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      ) : (
        <Button asChild variant="secondary" size="lg" className="w-full font-semibold">
          <Link href="/auth/sign-in">Sign In to Sync</Link>
        </Button>
      )}
    </PageContainer>
  );
}
