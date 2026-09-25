"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  RotateCcw,
  Bookmark,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { formatAccuracy } from "@/domain/practice";
import type { MockTestResultDetail } from "@/domain/mock-engine";

export interface MockResultViewProps {
  result: MockTestResultDetail;
}

type ReviewFilter = "all" | "incorrect" | "unanswered" | "correct" | "marked";

export function MockResultView({ result }: MockResultViewProps) {
  const [filter, setFilter] = React.useState<ReviewFilter>("all");

  const {
    mockTitle,
    rawScore,
    totalMarks,
    correct,
    incorrect,
    unattempted,
    markedForReviewCount,
    accuracy,
    timeSpentSeconds,
    submissionStatus,
    sections,
    questions,
  } = result;

  // Format mm:ss
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const filteredQuestions = React.useMemo(() => {
    return questions.filter((q) => {
      if (filter === "incorrect") return q.isAttempted && !q.isCorrect;
      if (filter === "unanswered") return !q.isAttempted;
      if (filter === "correct") return q.isCorrect;
      if (filter === "marked") return q.isMarkedForReview;
      return true;
    });
  }, [questions, filter]);

  return (
    <PageContainer className="py-6 sm:py-8 max-w-5xl" size="default">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Link href="/app/mock-tests">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Mock Tests</span>
            </Link>
          </Button>

          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                submissionStatus === "auto_submitted"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {submissionStatus.replace("_", " ")}
            </span>
          </div>

          <h1 className="type-h2">{mockTitle} — Result Summary</h1>
          <p className="mt-1 type-body text-muted-foreground">
            Complete exam simulation evaluation, section breakdown, and authoritative answer reviews.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            className="min-h-[44px] gap-2 font-semibold text-xs sm:text-sm"
          >
            <Link href="/app/mock-tests">
              <ArrowLeft className="h-4 w-4" />
              <span>Mock Hub</span>
            </Link>
          </Button>

          <Button
            asChild
            className="min-h-[44px] gap-2 font-semibold text-xs sm:text-sm shadow-sm"
          >
            <Link href={`/app/mock-tests/${result.mockTestId}`}>
              <RotateCcw className="h-4 w-4" />
              <span>Take Again</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Primary Score Hero Card */}
      <Card variant="base" className="p-6 sm:p-8 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Main Score Hero */}
          <div className="text-center md:text-left md:border-r border-border md:pr-6">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Final Raw Score
            </span>
            <div className="flex items-baseline justify-center md:justify-start gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                {rawScore}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">
                / {totalMarks}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Time Used: {formatTime(timeSpentSeconds)}</span>
            </div>
          </div>

          {/* Accuracy & Breakdown Stat */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <span className="text-xl font-bold text-foreground block">
                {formatAccuracy(accuracy)}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                Accuracy
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 block">
                {correct}
              </span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold uppercase">
                Correct
              </span>
            </div>

            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <span className="text-xl font-bold text-destructive block">
                {incorrect}
              </span>
              <span className="text-[10px] text-destructive/80 font-semibold uppercase">
                Incorrect
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <span className="text-xl font-bold text-amber-700 dark:text-amber-300 block">
                {unattempted}
              </span>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-semibold uppercase">
                Unanswered
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Section-Level Breakdown (if sections exist) */}
      {sections && sections.length > 0 && (
        <div className="mb-8">
          <SectionHeader
            title="Section Performance"
            description="Detailed score and accuracy breakdown across exam sections."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sections.map((sec) => (
              <Card key={sec.sectionId} className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-sm text-foreground">{sec.name}</span>
                  <span className="text-xs font-bold text-primary">
                    {formatAccuracy(sec.accuracyBps)} Acc
                  </span>
                </div>

                <div className="text-2xl font-bold text-foreground mb-3">
                  {sec.rawScore} <span className="text-xs font-normal text-muted-foreground">/ {sec.maxScore} marks</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] pt-3 border-t border-border">
                  <div className="bg-muted/40 p-1.5 rounded">
                    <span className="font-bold block text-foreground">{sec.totalQuestions}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">Questions</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded">
                    <span className="font-bold block text-emerald-700 dark:text-emerald-300">
                      {sec.correct}
                    </span>
                    <span className="text-[9px] text-emerald-700/80 uppercase">Correct</span>
                  </div>
                  <div className="bg-destructive/10 p-1.5 rounded">
                    <span className="font-bold block text-destructive">{sec.incorrect}</span>
                    <span className="text-[9px] text-destructive/80 uppercase">Incorrect</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 4. Question Review Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Question-by-Question Review</h2>
            <p className="text-xs text-muted-foreground">
              Verify your answers against authoritative explanations and scoring.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${questions.length})` },
                { id: "incorrect", label: `Incorrect (${incorrect})` },
                { id: "unanswered", label: `Unanswered (${unattempted})` },
                { id: "correct", label: `Correct (${correct})` },
                { id: "marked", label: `Marked (${markedForReviewCount})` },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                  filter === btn.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        {filteredQuestions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-xs">
            No questions match the selected filter.
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const statusBadge = q.isAttempted
                ? q.isCorrect
                  ? { label: "Correct", style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" }
                  : { label: "Incorrect", style: "bg-destructive/15 text-destructive" }
                : { label: "Unanswered", style: "bg-muted text-muted-foreground" };

              return (
                <Card key={q.questionId} className="p-5 sm:p-6 shadow-xs">
                  {/* Question Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        Q{q.displayOrder}
                      </span>
                      {q.sectionName && (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                          {q.sectionName}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadge.style}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {q.isMarkedForReview && (
                        <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Bookmark className="h-3 w-3 fill-current" />
                          Marked
                        </span>
                      )}
                      <span className="text-xs font-bold text-foreground">
                        {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded} Marks
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-sm sm:text-base font-medium text-foreground mb-4 leading-relaxed">
                    {q.text}
                  </div>

                  {/* Options */}
                  <div className="space-y-2 mb-4">
                    {q.options.map((opt) => {
                      const isSelected = opt.id === q.selectedOptionId;
                      const isCorrect = opt.isCorrect;

                      let optStyle = "border-border bg-card text-foreground";
                      if (isCorrect) {
                        optStyle = "border-emerald-500 bg-emerald-500/10 text-foreground font-medium";
                      } else if (isSelected && !isCorrect) {
                        optStyle = "border-destructive bg-destructive/10 text-foreground";
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-3 ${optStyle}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="h-6 w-6 rounded text-xs font-bold flex items-center justify-center bg-muted border border-border">
                              {opt.optionKey}
                            </span>
                            <span>{opt.text}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                            {isSelected && (
                              <span className="text-muted-foreground text-[11px] mr-1">
                                [Your Answer]
                              </span>
                            )}
                            {isCorrect && (
                              <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
                                <Check className="h-4 w-4" />
                                Correct
                              </span>
                            )}
                            {isSelected && !isCorrect && (
                              <span className="text-destructive flex items-center gap-0.5">
                                <X className="h-4 w-4" />
                                Incorrect
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Authoritative Explanation */}
                  {q.explanation && (
                    <div className="p-3.5 rounded-lg bg-muted/60 border border-border text-xs leading-relaxed text-foreground">
                      <strong className="text-foreground block mb-1">Explanation:</strong>
                      <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
