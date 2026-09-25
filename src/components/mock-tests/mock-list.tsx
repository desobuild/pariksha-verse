"use client";

import * as React from "react";
import Link from "next/link";
import {
  Timer,
  Trophy,
  ClipboardCheck,
  ChevronRight,
  HelpCircle,
  Play,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/shared/icon-tile";
import { SectionHeader } from "@/components/shared/section-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatAccuracy } from "@/domain/practice";
import type { MockTestDetail, MockTestResultDetail } from "@/domain/mock-engine";

export interface MockListProps {
  mockTests: MockTestDetail[];
  results: MockTestResultDetail[];
  workspaceId: string;
}

export function MockList({ mockTests, results, workspaceId: _workspaceId }: MockListProps) {
  const mocksTaken = results.length;
  const bestScore = results.length > 0 ? Math.max(...results.map((r) => r.rawScore)) : null;
  const bestTotalMarks = results.length > 0 ? results[0].totalMarks : 0;

  const avgAccuracyBps =
    results.length > 0
      ? Math.round(results.reduce((acc, r) => acc + r.accuracy, 0) / results.length)
      : 0;

  // Format mm:ss
  const formatTimeSpent = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8">
      {/* 1. Performance Overview Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <IconTile variant="tint" size="sm">
            <Timer className="h-4 w-4" aria-hidden="true" />
          </IconTile>
          <div>
            <p className="text-xl font-bold leading-none text-foreground">{mocksTaken}</p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
              Mocks Taken
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <IconTile variant="tint" size="sm">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
          </IconTile>
          <div>
            <p className="text-xl font-bold leading-none text-foreground">
              {bestScore !== null ? `${bestScore} / ${bestTotalMarks}` : "—"}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
              Best Score
            </p>
          </div>
        </Card>

        <Card className="col-span-2 sm:col-span-1 flex items-center gap-3 p-4">
          <IconTile variant="tint" size="sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          </IconTile>
          <div>
            <p className="text-xl font-bold leading-none text-foreground">
              {mocksTaken > 0 ? formatAccuracy(avgAccuracyBps) : "—"}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
              Avg Accuracy
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Available Mock Tests */}
      <div>
        <SectionHeader
          title="Available Mock Tests"
          description="Standard timed practice simulations with deterministic question sets and authoritative marking."
        />

        {mockTests.length === 0 ? (
          <EmptyState
            icon={<HelpCircle className="h-6 w-6" />}
            title="No mock tests available"
            description="Mock tests will appear here once configured for your workspace target exam."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockTests.map((mock) => {
              const previousAttempts = results.filter((r) => r.mockTestId === mock.id);
              const latestAttempt = previousAttempts[0];

              return (
                <Card
                  key={mock.id}
                  variant="base"
                  className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm"
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                        {mock.provenance === "fixture" ? "Sample Mock" : "Practice Mock"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-muted text-muted-foreground">
                        {mock.type.replace("_", " ")}
                      </span>
                      {mock.sections && mock.sections.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary/15 text-secondary-foreground flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {mock.sections.length} Sections
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-base font-bold text-foreground leading-snug">
                      {mock.title}
                    </h2>
                    {mock.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {mock.description}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-muted/50 p-2 rounded-md">
                        <span className="block font-bold text-foreground">
                          {mock.totalQuestions}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">Questions</span>
                      </div>
                      <div className="bg-muted/50 p-2 rounded-md">
                        <span className="block font-bold text-foreground">
                          {mock.durationMinutes}m
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">Duration</span>
                      </div>
                      <div className="bg-muted/50 p-2 rounded-md">
                        <span className="block font-bold text-foreground">
                          +{mock.markingScheme.correctMarks} / -{mock.markingScheme.incorrectPenalty}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">Marking</span>
                      </div>
                    </div>

                    {/* Previous Attempt Note */}
                    {latestAttempt && (
                      <div className="mt-3 p-2 rounded-md bg-muted/30 text-xs flex items-center justify-between">
                        <span className="text-muted-foreground">Latest Score:</span>
                        <span className="font-semibold text-foreground">
                          {latestAttempt.rawScore} / {latestAttempt.totalMarks} (
                          {latestAttempt.accuracyPct}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-3">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-xs font-semibold flex-1"
                    >
                      <Link href={`/app/mock-tests/${mock.id}`}>
                        Instructions
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      className="min-h-[44px] text-xs font-semibold flex-1 gap-1.5 shadow-sm"
                    >
                      <Link href={`/app/mock-tests/${mock.id}`}>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Start Mock</span>
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Completed Attempts History */}
      <div>
        <SectionHeader
          title="Attempt History"
          description="Your previous completed and auto-submitted exam simulations."
        />

        {results.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No completed mocks yet"
            description="Take your first timed mock test above to see score breakdown, accuracy, and question reviews."
            className="min-h-[180px]"
          />
        ) : (
          <div className="space-y-3">
            {results.map((r) => (
              <Card
                key={r.id}
                variant="base"
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{r.mockTitle}</span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-semibold capitalize ${
                        r.submissionStatus === "auto_submitted"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {r.submissionStatus.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Completed: {new Date(r.completedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span>Time used: {formatTimeSpent(r.timeSpentSeconds)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <div className="text-left sm:text-right">
                    <span className="text-base font-bold text-foreground block">
                      {r.rawScore} / {r.totalMarks}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Accuracy: {formatAccuracy(r.accuracy)}
                    </span>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] gap-1 text-xs font-semibold"
                  >
                    <Link
                      href={
                        r.sessionId
                          ? `/app/mock-tests/${r.mockTestId}/session/${r.sessionId}/result`
                          : `/app/mock-tests/${r.mockTestId}`
                      }
                    >
                      <span>Review</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
