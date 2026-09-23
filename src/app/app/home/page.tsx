"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  Search,
  BookOpen,
  Sparkles,
  History,
  Loader2,
  Target,
} from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useAuth } from "@/lib/auth/use-auth";
import { getExamAttempt, getExamForAttempt } from "@/domain/exam-catalog";
import { resolveActiveExamAttempt } from "@/domain/exam";
import { formatStudyGoal, getPreparationStageLabel } from "@/domain/preparation";
import type { UserPreferences } from "@/db/schema";

export default function HomePage() {
  const router = useRouter();
  const { workspace, status, refresh } = useActiveWorkspace();
  const repos = useRepositories();
  const { isMigrating } = useAuth();
  const [preferences, setPreferences] = React.useState<UserPreferences | null>(null);

  React.useEffect(() => {
    if (status !== "ready" || !workspace) return;
    let cancelled = false;
    repos.preferences
      .getUserPreferences()
      .then((prefs) => {
        if (!cancelled) setPreferences(prefs);
      })
      .catch(() => {
        /* preferences are optional for the shell */
      });
    return () => {
      cancelled = true;
    };
  }, [status, workspace, repos]);

  // Guest → account migration may bring the workspace in asynchronously:
  // re-resolve once it settles instead of bouncing the user to onboarding.
  const sawMount = React.useRef(false);
  React.useEffect(() => {
    if (sawMount.current && !isMigrating) {
      void refresh();
    }
    sawMount.current = true;
  }, [isMigrating, refresh]);

  // Returning users land straight in their space; new users enter onboarding.
  React.useEffect(() => {
    if (status === "ready" && !workspace && !isMigrating) {
      router.replace("/exam/select");
    }
  }, [status, workspace, isMigrating, router]);

  if (status === "loading" || !workspace) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading your preparation space" />
          <p className="text-sm">Resolving your preparation space…</p>
        </div>
      </PageContainer>
    );
  }

  const attempt = getExamAttempt(workspace.examAttemptId) ?? resolveActiveExamAttempt();
  const exam = getExamForAttempt(workspace.examAttemptId);
  const examDate = attempt.examDate
    ? attempt.examDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Date to be announced";
  const daysLeft = attempt.examDate
    ? Math.max(
        0,
        Math.ceil((attempt.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;
  const goalLabel = formatStudyGoal(preferences?.dailyStudyGoalMinutes);
  const stageLabel = getPreparationStageLabel(preferences?.preparationStage);

  return (
    <PageContainer>
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="type-h1">Welcome back</h1>
        <p className="mt-1 type-body text-muted-foreground">Ready to make today count?</p>
      </div>

      {/* Search affordance — activates with the Study module */}
      <div
        className="mb-6 flex h-12 w-full items-center gap-3 rounded-full bg-surface-tint px-4 text-sm text-foreground-subtle"
        aria-hidden="true"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search topics, chapters &amp; resources</span>
      </div>

      {/* Active preparation summary */}
      <Card className="mb-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <IconTile variant="strong" size="lg">
              <CalendarCheck className="h-6 w-6" />
            </IconTile>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{attempt.label}</p>
                {attempt.isProvisional && <Badge variant="primary">Provisional syllabus</Badge>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground-subtle">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Exam on {examDate}
                {daysLeft !== null && ` · ${daysLeft} days to go`}
              </p>
            </div>
          </div>
          <Link
            href="/exam/select"
            className="shrink-0 self-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Change target exam"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </Card>

      {/* Preparation profile */}
      <Card className="mb-8 p-5" variant="muted">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <IconTile variant="tint" size="sm">
              <Clock className="h-4 w-4" />
            </IconTile>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">{goalLabel}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-foreground-subtle">Daily goal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconTile variant="tint" size="sm">
              <Target className="h-4 w-4" />
            </IconTile>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{stageLabel}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-foreground-subtle">Current stage</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Continue studying */}
      <SectionHeader title="Continue Studying" />
      <Card className="mb-8 p-5" variant="base">
        <div className="flex items-center gap-3.5">
          <IconTile variant="tint" size="lg">
            <BookOpen className="h-6 w-6" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">Pick up your syllabus</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground-subtle">
              {exam
                ? `Your ${exam.shortName} chapter progress and study sessions will appear here when the Study module ships.`
                : "Your chapter progress and study sessions will appear here when the Study module ships."}
            </p>
          </div>
        </div>
      </Card>

      {/* Today's focus */}
      <SectionHeader title="Today's Focus" />
      <div className="space-y-3">
        <Card className="p-4">
          <div className="flex items-center gap-3.5">
            <IconTile variant="tint" size="md">
              <Sparkles className="h-5 w-5" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Daily plan</p>
              <p className="mt-0.5 text-xs text-foreground-subtle">
                Scheduled tasks for today will appear here.
              </p>
            </div>
            <Badge variant="neutral">Planner</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3.5">
            <IconTile variant="tint" size="md">
              <History className="h-5 w-5" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Revision queue</p>
              <p className="mt-0.5 text-xs text-foreground-subtle">
                Spaced-repetition items due today will appear here.
              </p>
            </div>
            <Badge variant="neutral">Revision</Badge>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
