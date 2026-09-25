"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ArrowLeft,
  Clock,
  Award,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/navigation/page-container";
import { formatAccuracy } from "@/domain/practice";
import type { QuestionSessionResult } from "@/domain/practice-engine";

export interface QuestionResultViewProps {
  result: QuestionSessionResult;
  onPracticeAgain?: () => void;
}

type ReviewFilter = "all" | "incorrect" | "unanswered" | "correct";

export function QuestionResultView({ result, onPracticeAgain }: QuestionResultViewProps) {
  const [filter, setFilter] = React.useState<ReviewFilter>("all");

  const {
    totalQuestions,
    attempted,
    correct,
    incorrect,
    unanswered,
    accuracyBps,
    durationSeconds,
    questions,
  } = result;

  const isWeak = attempted > 0 && accuracyBps < 6000;
  const isMastered = attempted > 0 && accuracyBps >= 8000;

  // Format time mm:ss
  const formatDuration = (totalSec: number) => {
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
      return true;
    });
  }, [questions, filter]);

  return (
    <PageContainer className="py-6 sm:py-8" size="default">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Award className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">Practice Result</span>
          </div>
          <h1 className="type-h2">Practice Session Summary</h1>
          <p className="mt-1 type-body text-muted-foreground">
            Review your score, analyze individual question answers, and verify conceptual explanations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            className="min-h-[44px] gap-2 font-semibold"
          >
            <Link href="/app/practice">
              <ArrowLeft className="h-4 w-4" />
              Practice Hub
            </Link>
          </Button>

          {onPracticeAgain && (
            <Button
              onClick={onPracticeAgain}
              className="min-h-[44px] gap-2 font-semibold shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Practice Again
            </Button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Accuracy Card */}
        <Card variant="base" className="p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Accuracy
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-extrabold ${
                accuracyBps >= 6000
                  ? "text-emerald-600 dark:text-emerald-400"
                  : attempted === 0
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {attempted > 0 ? formatAccuracy(accuracyBps) : "—"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            Target: 60%+
          </span>
        </Card>

        {/* Correct Answers */}
        <Card variant="base" className="p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Correct
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {correct}
            </span>
            <span className="text-xs text-muted-foreground">/ {totalQuestions}</span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
            {totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0}% of session
          </span>
        </Card>

        {/* Incorrect & Unanswered */}
        <Card variant="base" className="p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Incorrect / Skipped
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {incorrect} <span className="text-xs text-muted-foreground font-normal">inc</span>
              {" · "}
              {unanswered} <span className="text-xs text-muted-foreground font-normal">skip</span>
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {attempted} attempted
          </span>
        </Card>

        {/* Time Spent */}
        <Card variant="base" className="p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Duration
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {formatDuration(durationSeconds)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {totalQuestions > 0 && durationSeconds > 0
              ? `~${Math.round(durationSeconds / totalQuestions)}s / question`
              : "Completed"}
          </span>
        </Card>
      </div>

      {/* 3. Feedback Banner */}
      {isWeak ? (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Added to Weak Topics ({formatAccuracy(accuracyBps)})</p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
              Accuracy for this session is below the 60% readiness threshold. This topic has been updated in your Practice &amp; Performance tracking and will appear in Today&apos;s Focus for targeted review.
            </p>
          </div>
        </div>
      ) : isMastered ? (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-3 mb-6">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Strong Performance ({formatAccuracy(accuracyBps)})</p>
            <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
              Great grasp of concepts! Your updated performance has been logged into your preparation analytics.
            </p>
          </div>
        </div>
      ) : null}

      {/* 4. Question-by-Question Review Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="type-h3">Question-by-Question Review</h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-0.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({totalQuestions})
            </button>
            <button
              type="button"
              onClick={() => setFilter("incorrect")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                filter === "incorrect"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Incorrect ({incorrect})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unanswered")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                filter === "unanswered"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Skipped ({unanswered})
            </button>
            <button
              type="button"
              onClick={() => setFilter("correct")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                filter === "correct"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Correct ({correct})
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const isCorrect = q.isAttempted && q.isCorrect;
            const isIncorrect = q.isAttempted && !q.isCorrect;
            const isSkipped = !q.isAttempted;

            return (
              <Card key={q.questionId} variant="base" className="p-5 sm:p-6 space-y-4 shadow-sm">
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      Q{q.displayOrder}
                    </span>

                    {isCorrect && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Correct
                      </span>
                    )}
                    {isIncorrect && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <XCircle className="h-3.5 w-3.5" />
                        Incorrect
                      </span>
                    )}
                    {isSkipped && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Skipped
                      </span>
                    )}
                  </div>

                  {q.topicName && (
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      {q.topicName}
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
                  {q.text}
                </p>

                {/* Options List */}
                <div className="space-y-2 pt-1">
                  {q.options.map((opt) => {
                    const isUserSelection = opt.id === q.selectedOptionId;
                    const isOptionCorrect = opt.isCorrect;

                    let optionBorder = "border-border bg-card";
                    if (isOptionCorrect) {
                      optionBorder = "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20";
                    } else if (isUserSelection && !isOptionCorrect) {
                      optionBorder = "border-rose-500 bg-rose-50/60 dark:bg-rose-950/20";
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-lg border text-sm flex items-start gap-3 transition-colors ${optionBorder}`}
                      >
                        {/* Option Key Badge */}
                        <div
                          className={`flex items-center justify-center h-6 w-6 rounded text-xs font-bold shrink-0 ${
                            isOptionCorrect
                              ? "bg-emerald-600 text-white"
                              : isUserSelection
                              ? "bg-rose-600 text-white"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {opt.optionKey}
                        </div>

                        {/* Option Text */}
                        <div className="flex-1 pt-0.5 leading-normal text-foreground">
                          {opt.text}
                        </div>

                        {/* Status Label */}
                        {isOptionCorrect && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                            Correct Answer
                          </span>
                        )}
                        {isUserSelection && !isOptionCorrect && (
                          <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 shrink-0">
                            Your Choice
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Card */}
                {q.explanation && (
                  <div className="p-3.5 rounded-lg bg-surface-tint/20 border border-border/80 text-xs leading-relaxed text-muted-foreground mt-3">
                    <span className="font-semibold text-foreground block mb-1">
                      Explanation:
                    </span>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </PageContainer>
  );
}
