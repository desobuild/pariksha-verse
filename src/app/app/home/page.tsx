"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { Button } from "@/components/ui/button";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useAuth } from "@/lib/auth/use-auth";
import { loadDashboardData, type DashboardSnapshot } from "@/domain/dashboard";
import {
  DashboardHeader,
  TodaysFocusCard,
  TodaysStudyPlan,
  ProgressSnapshot,
  AttentionNeeded,
  RecentActivity,
  QuickActions,
} from "@/components/dashboard";
import type { PlannerTask } from "@/db/schema";

export default function HomePage() {
  const router = useRouter();
  const { workspace, status, refresh } = useActiveWorkspace();
  const repos = useRepositories();
  const { isMigrating } = useAuth();

  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null);
  const [loadingData, setLoadingData] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  // Fetch dashboard domain data whenever workspace or repos change
  const fetchData = React.useCallback(async () => {
    if (!workspace) return;
    setLoadingData(true);
    setError(null);
    try {
      const data = await loadDashboardData(repos, workspace);
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoadingData(false);
    }
  }, [repos, workspace]);

  React.useEffect(() => {
    if (status === "ready" && workspace) {
      void fetchData();
    }
  }, [status, workspace, fetchData]);

  // Handle task status toggling
  const handleToggleTask = async (taskId: string, currentStatus: PlannerTask["status"]) => {
    const nextStatus = currentStatus === "completed" ? "upcoming" : "completed";

    // Optimistic UI update
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        todaysTasks: prev.todaysTasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus } : t
        ),
      };
    });

    try {
      await repos.planner.updateTaskStatus(taskId, nextStatus);
    } catch {
      // Revert on error
      void fetchData();
    }
  };

  if (status === "loading" || !workspace || loadingData) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading your preparation space" />
          <p className="text-sm font-medium">Resolving your preparation space…</p>
        </div>
      </PageContainer>
    );
  }

  if (error && !snapshot) {
    return (
      <PageContainer>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-foreground">Could not load dashboard</p>
          <p className="text-xs text-foreground-subtle max-w-sm">{error}</p>
          <Button size="sm" onClick={() => void fetchData()} className="mt-2 gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!snapshot) return null;

  return (
    <PageContainer className="py-6 sm:py-8 max-w-7xl">
      {/* Header: Exam Countdown & Preparation Profile */}
      <DashboardHeader examData={snapshot.exam} />

      {/* Main Responsive Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (Dominant: Focus & Daily Actions) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Today's Focus: Primary Section */}
          <TodaysFocusCard focus={snapshot.todaysFocus} />

          {/* Today's Study Plan */}
          <TodaysStudyPlan
            tasks={snapshot.todaysTasks}
            examAttemptId={workspace.examAttemptId}
            onToggleComplete={handleToggleTask}
          />

          {/* Attention Needed */}
          <AttentionNeeded items={snapshot.attentionItems} />
        </div>

        {/* Right Column (Overview, Analytics & Recent Activity) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Progress Snapshot */}
          <ProgressSnapshot progress={snapshot.progress} />

          {/* Quick Actions */}
          <QuickActions />

          {/* Recent Activity */}
          <RecentActivity activities={snapshot.recentActivity} />
        </div>
      </div>
    </PageContainer>
  );
}
