"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Send,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRepositories } from "@/repositories/repository-provider";
import type { QuestionSessionWithAttempts } from "@/domain/practice-engine";

export interface QuestionPlayerProps {
  initialSession: QuestionSessionWithAttempts;
  workspaceId: string;
}

export function QuestionPlayer({ initialSession, workspaceId }: QuestionPlayerProps) {
  const router = useRouter();
  const repos = useRepositories();

  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [answers, setAnswers] = React.useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const att of initialSession.attempts) {
      initial[att.questionId] = att.selectedOptionId;
    }
    return initial;
  });

  // Elapsed timer in seconds
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(initialSession.durationSeconds || 0);

  // Modals
  const [showExitDialog, setShowExitDialog] = React.useState<boolean>(false);
  const [showReviewDialog, setShowReviewDialog] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Timer interval
  React.useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const questions = initialSession.questions;
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const currentSelectedOptionId = currentQuestion ? answers[currentQuestion.id] ?? null : null;

  // Counts
  const answeredCount = Object.values(answers).filter((val) => Boolean(val)).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // Format mm:ss
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSelectOption = React.useCallback(async (optionId: string) => {
    if (!currentQuestion) return;
    const newAnswer = currentSelectedOptionId === optionId ? null : optionId;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: newAnswer,
    }));

    // Record through repository asynchronously
    try {
      await repos.questionSession.recordAnswer({
        sessionId: initialSession.id,
        workspaceId,
        questionId: currentQuestion.id,
        selectedOptionId: newAnswer,
      });
    } catch {
      // Offline or local error handled gracefully
    }
  }, [currentQuestion, currentSelectedOptionId, initialSession.id, repos.questionSession, workspaceId]);

  const handleClearAnswer = async () => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: null,
    }));

    try {
      await repos.questionSession.recordAnswer({
        sessionId: initialSession.id,
        workspaceId,
        questionId: currentQuestion.id,
        selectedOptionId: null,
      });
    } catch {
      // Ignore
    }
  };

  const handlePrevious = React.useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < totalQuestions - 1) {
        return prev + 1;
      }
      setShowReviewDialog(true);
      return prev;
    });
  }, [totalQuestions]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await repos.questionSession.submitSession({
        sessionId: initialSession.id,
        workspaceId,
        durationSeconds: elapsedSeconds,
        answers,
      });

      setShowReviewDialog(false);
      router.push(`/app/practice/session/${initialSession.id}/result`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit session");
      setSubmitting(false);
    }
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (["1", "2", "3", "4"].includes(e.key) && currentQuestion) {
        const optIndex = parseInt(e.key, 10) - 1;
        if (currentQuestion.options[optIndex]) {
          handleSelectOption(currentQuestion.options[optIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion, handleNext, handlePrevious, handleSelectOption]);

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">No questions found in this session.</p>
      </div>
    );
  }

  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        {/* Linear progress track */}
        <div className="w-full bg-muted h-1">
          <div
            className="bg-primary h-1 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Exit Button */}
          <button
            type="button"
            onClick={() => setShowExitDialog(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted min-h-[44px] transition-colors"
            aria-label="Exit session"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          {/* Progress / Scope info */}
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary block">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {initialSession.scopeType} Practice
            </span>
          </div>

          {/* Timer & Palette Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-mono font-medium text-foreground min-h-[36px]">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReviewDialog(true)}
              aria-label="Review practice session"
              className="text-xs min-h-[44px] font-semibold hidden sm:flex"
            >
              Review ({answeredCount}/{totalQuestions})
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Main Question Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-28">
        <Card variant="base" className="p-5 sm:p-7 shadow-sm">
          {/* Question Metadata Row */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                Single Choice
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground capitalize">
                {currentQuestion.difficulty}
              </span>
            </div>

            {currentSelectedOptionId && (
              <button
                type="button"
                onClick={handleClearAnswer}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 p-1 hover:underline min-h-[32px]"
              >
                <RotateCcw className="h-3 w-3" />
                Clear choice
              </button>
            )}
          </div>

          {/* Question Text */}
          <div className="mb-6">
            <h1 className="text-base sm:text-lg font-medium leading-relaxed text-foreground select-text">
              {currentQuestion.text}
            </h1>
          </div>

          {/* Answer Options */}
          <div
            role="radiogroup"
            aria-label="Answer options"
            className="space-y-3"
          >
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = opt.id === currentSelectedOptionId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:bg-muted/50 hover:border-border-strong"
                  }`}
                >
                  {/* Option Badge */}
                  <div
                    className={`flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {opt.optionKey || String.fromCharCode(65 + idx)}
                  </div>

                  {/* Option Text */}
                  <div className="flex-1 text-sm pt-0.5 leading-normal">
                    {opt.text}
                  </div>

                  {/* Check Indicator */}
                  {isSelected && (
                    <CheckCircle2
                      className="h-5 w-5 text-primary shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </main>

      {/* 3. Sticky Bottom Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Previous Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Quick Palette Button on Mobile */}
          <button
            type="button"
            onClick={() => setShowReviewDialog(true)}
            aria-label="Review practice session"
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 min-h-[44px] flex items-center gap-1.5 sm:hidden"
          >
            <span>{answeredCount}/{totalQuestions} Answered</span>
          </button>

          {/* Next / Review & Submit Button */}
          {currentIndex < totalQuestions - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setShowReviewDialog(true)}
              className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm shadow-sm"
            >
              <span>Review &amp; Submit</span>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>

      {/* 4. Submission Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-h3 text-foreground">Practice Session Review</DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              Review your answered questions before final submission.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-2 py-3 text-center">
            <div className="p-3 rounded-lg bg-muted border border-border">
              <span className="text-xl font-bold text-foreground block">{totalQuestions}</span>
              <span className="text-[11px] text-muted-foreground font-medium uppercase">Total</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 block">{answeredCount}</span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium uppercase">Answered</span>
            </div>
            <div className={`p-3 rounded-lg border ${
              unansweredCount > 0
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                : "bg-muted border-border text-muted-foreground"
            }`}>
              <span className="text-xl font-bold block">{unansweredCount}</span>
              <span className="text-[11px] font-medium uppercase">Unanswered</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You have {unansweredCount} unanswered {unansweredCount === 1 ? "question" : "questions"}. You can jump back to any question below to complete it.
            </p>
          )}

          {/* Question Grid Navigator */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Jump to question
            </span>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]);
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowReviewDialog(false);
                    }}
                    className={`h-9 w-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                      isCurrent
                        ? "ring-2 ring-primary ring-offset-2"
                        : ""
                    } ${
                      isAnswered
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
              className="min-h-[44px]"
              disabled={submitting}
            >
              Continue Practicing
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-h-[44px] gap-2 font-semibold shadow-sm"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Grading..." : "Submit Practice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Safe Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-h3 text-foreground">Exit Practice Session?</DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              Are you sure you want to leave? Your answers will not be submitted or recorded in your performance progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              className="min-h-[44px]"
            >
              Resume
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => router.push("/app/practice")}
              className="min-h-[44px]"
            >
              Exit Practice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
