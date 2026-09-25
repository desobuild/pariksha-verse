"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  X,
  Send,
  Bookmark,
  BookmarkCheck,
  Layers,
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
import type {
  MockTestSessionDetail,
  MockSectionConfig,
} from "@/domain/mock-engine";

export interface MockExamPlayerProps {
  initialSession: MockTestSessionDetail;
  workspaceId: string;
}

export function MockExamPlayer({ initialSession, workspaceId }: MockExamPlayerProps) {
  const router = useRouter();
  const repos = useRepositories();

  const [currentIndex, setCurrentIndex] = React.useState<number>(
    initialSession.currentIndex || 0
  );

  const [answers, setAnswers] = React.useState<Record<string, string | null>>(
    () => initialSession.selectedAnswers || {}
  );

  const [markedForReview, setMarkedForReview] = React.useState<string[]>(
    () => initialSession.markedForReview || []
  );

  // Authoritative expiry time in ms
  const expiresAtMs = React.useMemo(() => {
    return new Date(initialSession.expiresAt).getTime();
  }, [initialSession.expiresAt]);

  // Remaining seconds calculated from authoritative timestamp
  const calculateSecondsRemaining = React.useCallback(() => {
    const diff = Math.floor((expiresAtMs - Date.now()) / 1000);
    return Math.max(0, diff);
  }, [expiresAtMs]);

  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(
    calculateSecondsRemaining
  );

  // Dialog states
  const [showExitDialog, setShowExitDialog] = React.useState<boolean>(false);
  const [showReviewDialog, setShowReviewDialog] = React.useState<boolean>(false);
  const [showPaletteSheet, setShowPaletteSheet] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const autoSubmitTriggeredRef = React.useRef<boolean>(false);

  const questions = initialSession.questions;
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const mockTest = initialSession.mockTest;

  // Active section
  const currentSection = React.useMemo(() => {
    if (!mockTest.sections || mockTest.sections.length === 0 || !currentQuestion) {
      return null;
    }
    return (
      mockTest.sections.find((s) => s.subjectId && s.subjectId === currentQuestion.subjectId) ||
      mockTest.sections.find((s) => s.topicId && s.topicId === currentQuestion.topicId) ||
      mockTest.sections[0]
    );
  }, [mockTest.sections, currentQuestion]);

  // Format mm:ss or hh:mm:ss
  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Submission handler
  const executeSubmission = React.useCallback(
    async (isAutoSubmit: boolean = false) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      if (isAutoSubmit) {
        setIsAutoSubmitting(true);
      }

      try {
        await repos.mock.submitSession({
          workspaceId,
          sessionId: initialSession.id,
          submissionStatus: isAutoSubmit ? "auto_submitted" : "completed",
          answers,
          markedForReview,
          completedAt: new Date(),
        });

        setShowReviewDialog(false);
        router.push(`/app/mock-tests/${mockTest.id}/session/${initialSession.id}/result`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit mock test");
        setSubmitting(false);
        setIsAutoSubmitting(false);
      }
    },
    [answers, initialSession.id, markedForReview, mockTest.id, repos.mock, router, submitting, workspaceId]
  );

  // Authoritative countdown timer loop
  React.useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateSecondsRemaining();
      setSecondsRemaining(remaining);

      // Auto submit upon expiry
      if (remaining <= 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        clearInterval(interval);
        executeSubmission(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateSecondsRemaining, executeSubmission]);

  // Question state calculations
  const currentSelectedOptionId = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const isCurrentMarked = currentQuestion ? markedForReview.includes(currentQuestion.id) : false;

  const answeredQuestionIds = Object.entries(answers)
    .filter(([_, optId]) => Boolean(optId))
    .map(([qid]) => qid);

  const answeredCount = answeredQuestionIds.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const markedCount = markedForReview.length;
  const answeredAndMarkedCount = markedForReview.filter((qid) => Boolean(answers[qid])).length;

  // Option selection
  const handleSelectOption = React.useCallback(
    async (optionId: string) => {
      if (!currentQuestion || secondsRemaining <= 0 || submitting) return;

      const newAnswer = currentSelectedOptionId === optionId ? null : optionId;

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: newAnswer,
      }));

      try {
        await repos.mock.updateSessionAnswer({
          workspaceId,
          sessionId: initialSession.id,
          questionId: currentQuestion.id,
          selectedOptionId: newAnswer,
          currentIndex,
        });
      } catch {
        // Offline / client persistence handled gracefully
      }
    },
    [currentQuestion, secondsRemaining, submitting, currentSelectedOptionId, repos.mock, workspaceId, initialSession.id, currentIndex]
  );

  // Clear current response
  const handleClearResponse = React.useCallback(async () => {
    if (!currentQuestion || secondsRemaining <= 0 || submitting) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: null,
    }));

    try {
      await repos.mock.updateSessionAnswer({
        workspaceId,
        sessionId: initialSession.id,
        questionId: currentQuestion.id,
        selectedOptionId: null,
        currentIndex,
      });
    } catch {
      // Ignore
    }
  }, [currentQuestion, secondsRemaining, submitting, repos.mock, workspaceId, initialSession.id, currentIndex]);

  // Toggle Mark for Review
  const handleToggleMarkForReview = React.useCallback(async () => {
    if (!currentQuestion || secondsRemaining <= 0 || submitting) return;

    const isMarked = markedForReview.includes(currentQuestion.id);
    const newMarked = isMarked
      ? markedForReview.filter((id) => id !== currentQuestion.id)
      : [...markedForReview, currentQuestion.id];

    setMarkedForReview(newMarked);

    try {
      await repos.mock.updateSessionAnswer({
        workspaceId,
        sessionId: initialSession.id,
        questionId: currentQuestion.id,
        isMarkedForReview: !isMarked,
        currentIndex,
      });
    } catch {
      // Ignore
    }
  }, [currentQuestion, secondsRemaining, submitting, markedForReview, repos.mock, workspaceId, initialSession.id, currentIndex]);

  // Navigation
  const handleJumpToIndex = React.useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= totalQuestions) return;
      setCurrentIndex(idx);
      setShowPaletteSheet(false);
      setShowReviewDialog(false);

      if (questions[idx]) {
        try {
          await repos.mock.updateSessionAnswer({
            workspaceId,
            sessionId: initialSession.id,
            questionId: questions[idx].id,
            currentIndex: idx,
          });
        } catch {
          // Ignore
        }
      }
    },
    [totalQuestions, questions, repos.mock, workspaceId, initialSession.id]
  );

  const handlePrevious = React.useCallback(() => {
    if (currentIndex > 0) {
      handleJumpToIndex(currentIndex - 1);
    }
  }, [currentIndex, handleJumpToIndex]);

  const handleNext = React.useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      handleJumpToIndex(currentIndex + 1);
    } else {
      setShowReviewDialog(true);
    }
  }, [currentIndex, totalQuestions, handleJumpToIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (["1", "2", "3", "4"].includes(e.key) && currentQuestion) {
        const optIdx = parseInt(e.key, 10) - 1;
        if (currentQuestion.options[optIdx]) {
          handleSelectOption(currentQuestion.options[optIdx].id);
        }
      } else if (e.key.toLowerCase() === "m") {
        handleToggleMarkForReview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion, handleNext, handlePrevious, handleSelectOption, handleToggleMarkForReview]);

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">No questions found in this mock test.</p>
      </div>
    );
  }

  // Timer urgency
  const isUrgent = secondsRemaining < 120; // under 2 mins
  const isCritical = secondsRemaining < 30; // under 30s
  const progressPct = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border shadow-xs">
        {/* Linear progress track */}
        <div className="w-full bg-muted h-1">
          <div
            className="bg-primary h-1 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Exit Button */}
          <button
            type="button"
            onClick={() => setShowExitDialog(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted min-h-[44px] transition-colors"
            aria-label="Exit simulation"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit Mock</span>
          </button>

          {/* Exam Title & Current Section */}
          <div className="text-center min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {mockTest.title}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              {currentSection && (
                <span className="font-semibold text-primary">
                  {currentSection.name} •
                </span>
              )}
              <span>
                Q {currentIndex + 1} of {totalQuestions}
              </span>
            </div>
          </div>

          {/* Timer & Submit Header Controls */}
          <div className="flex items-center gap-2">
            {/* Authoritative Countdown Timer */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold min-h-[38px] transition-colors ${
                isCritical
                  ? "bg-destructive/15 text-destructive border border-destructive/30 animate-pulse"
                  : isUrgent
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : "bg-muted text-foreground border border-border"
              }`}
              role="timer"
              aria-live="polite"
              aria-label={`Time remaining: ${formatTimer(secondsRemaining)}`}
            >
              <Clock
                className={`h-3.5 w-3.5 ${
                  isCritical ? "text-destructive" : isUrgent ? "text-amber-600" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>

            {/* Submit Button Header */}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setShowReviewDialog(true)}
              className="text-xs font-semibold min-h-[38px] gap-1.5 hidden sm:flex shadow-xs"
            >
              <span>Submit</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Section Tabs (if sectioned) */}
        {mockTest.sections && mockTest.sections.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 py-1.5 border-t border-border/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {mockTest.sections.map((sec: MockSectionConfig) => {
              const isSecActive = currentSection?.id === sec.id;
              // Count answered in this section
              const secQuestions = questions.filter(
                (q) =>
                  (sec.subjectId && q.subjectId === sec.subjectId) ||
                  (sec.topicId && q.topicId === sec.topicId)
              );
              const secAnswered = secQuestions.filter((q) => Boolean(answers[q.id])).length;

              // Jump to first question of section
              const firstQIdx = questions.findIndex(
                (q) =>
                  (sec.subjectId && q.subjectId === sec.subjectId) ||
                  (sec.topicId && q.topicId === sec.topicId)
              );

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    if (firstQIdx !== -1) handleJumpToIndex(firstQIdx);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap min-h-[32px] transition-colors flex items-center gap-1.5 ${
                    isSecActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{sec.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSecActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {secAnswered}/{sec.questionCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Auto-submission overlay banner */}
      {isAutoSubmitting && (
        <div className="bg-destructive text-destructive-foreground text-center py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <Clock className="h-4 w-4 animate-spin" />
          <span>Time has expired! Submitting your mock test automatically...</span>
        </div>
      )}

      {/* 2. Main Question Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
        <Card variant="base" className="p-5 sm:p-7 shadow-sm">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                Question {currentIndex + 1}
              </span>
              {currentSection && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                  {currentSection.name}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                Marks: +{mockTest.markingScheme.correctMarks}, -{mockTest.markingScheme.incorrectPenalty}
              </span>
            </div>

            {/* Review Status indicator */}
            {isCurrentMarked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                <BookmarkCheck className="h-3 w-3" />
                <span>Marked for Review</span>
              </span>
            )}
          </div>

          {/* Question Text */}
          <div className="text-base sm:text-lg font-medium leading-relaxed text-foreground mb-6">
            {currentQuestion.text}
          </div>

          {/* Options List */}
          <div className="space-y-3" role="radiogroup" aria-label="Question answer options">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = currentSelectedOptionId === opt.id;
              const optionNumber = idx + 1;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={secondsRemaining <= 0 || submitting}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border min-h-[48px] flex items-center justify-between gap-3 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30 font-medium"
                      : "border-border bg-card hover:bg-muted/40 text-foreground"
                  }`}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`h-7 w-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {opt.optionKey}
                    </span>
                    <span className="text-sm leading-relaxed break-words">{opt.text}</span>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline shrink-0">
                    [{optionNumber}]
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Toolbar */}
          <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <Button
              type="button"
              variant={isCurrentMarked ? "secondary" : "outline"}
              size="sm"
              onClick={handleToggleMarkForReview}
              disabled={secondsRemaining <= 0 || submitting}
              className={`min-h-[44px] gap-1.5 font-semibold text-xs ${
                isCurrentMarked ? "text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700" : ""
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isCurrentMarked ? "fill-current" : ""}`} />
              <span>{isCurrentMarked ? "Unmark Review" : "Mark for Review"}</span>
            </Button>

            {currentSelectedOptionId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearResponse}
                disabled={secondsRemaining <= 0 || submitting}
                className="min-h-[44px] text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Response
              </Button>
            )}
          </div>
        </Card>
      </main>

      {/* 3. Bottom Sticky Bar */}
      <footer className="sticky bottom-0 z-30 bg-background/95 backdrop-blur border-t border-border py-3 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Previous Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0 || submitting}
            className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Palette Toggle */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPaletteSheet(true)}
            className="min-h-[44px] gap-2 text-xs font-semibold"
          >
            <Layers className="h-4 w-4 text-primary" />
            <span>
              {answeredCount}/{totalQuestions} Answered
            </span>
            {markedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                {markedCount} Marked
              </span>
            )}
          </Button>

          {/* Next / Submit */}
          {currentIndex < totalQuestions - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setShowReviewDialog(true)}
              disabled={submitting}
              className="min-h-[44px] gap-1.5 font-semibold text-xs sm:text-sm shadow-sm"
            >
              <span>Review &amp; Submit</span>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>

      {/* 4. Question Palette Modal / Dialog */}
      <Dialog open={showPaletteSheet} onOpenChange={setShowPaletteSheet}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-h3 text-foreground">Question Palette</DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              Jump directly to any question. State is maintained continuously.
            </DialogDescription>
          </DialogHeader>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-medium py-2 border-y border-border">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-primary" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-muted border border-border" />
              <span>Unanswered ({unansweredCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-purple-500" />
              <span>Marked ({markedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-purple-500 ring-2 ring-emerald-500" />
              <span>Answered &amp; Marked ({answeredAndMarkedCount})</span>
            </div>
          </div>

          {/* Question Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-64 overflow-y-auto p-1">
            {questions.map((q, idx) => {
              const isAns = Boolean(answers[q.id]);
              const isMark = markedForReview.includes(q.id);
              const isCurr = idx === currentIndex;

              let style = "bg-muted text-muted-foreground border border-border hover:bg-muted/80";
              if (isAns && isMark) {
                style = "bg-purple-600 text-white ring-2 ring-emerald-500 font-bold";
              } else if (isMark) {
                style = "bg-purple-600 text-white font-bold";
              } else if (isAns) {
                style = "bg-primary text-primary-foreground font-bold";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleJumpToIndex(idx)}
                  className={`h-9 w-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${style} ${
                    isCurr ? "ring-2 ring-foreground ring-offset-2" : ""
                  }`}
                  aria-label={`Question ${idx + 1}, ${isAns ? "Answered" : "Unanswered"}, ${
                    isMark ? "Marked for review" : ""
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPaletteSheet(false)}
              className="min-h-[44px] w-full"
            >
              Close Palette
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Pre-Submission Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-h3 text-foreground">Submit Mock Test?</DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              Verify your question attempts before final authoritative submission.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-2 py-3 text-center">
            <div className="p-2.5 rounded-lg bg-muted border border-border">
              <span className="text-xl font-bold text-foreground block">{totalQuestions}</span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 block">{answeredCount}</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold uppercase">Answered</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-xl font-bold text-amber-700 dark:text-amber-300 block">{unansweredCount}</span>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-semibold uppercase">Unanswered</span>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <span className="text-xl font-bold text-purple-700 dark:text-purple-300 block">{markedCount}</span>
              <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 font-semibold uppercase">Marked</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Notice:</strong> You have {unansweredCount} unanswered questions. Incorrect answers incur -{mockTest.markingScheme.incorrectPenalty} negative marks, while unanswered questions receive {mockTest.markingScheme.unansweredMarks} marks.
            </div>
          )}

          {markedCount > 0 && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              * Note: {answeredAndMarkedCount} marked questions have answers selected and WILL be scored normally.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
              className="min-h-[44px]"
              disabled={submitting}
            >
              Continue Test
            </Button>
            <Button
              type="button"
              onClick={() => executeSubmission(false)}
              disabled={submitting}
              className="min-h-[44px] gap-2 font-semibold shadow-sm"
            >
              <Send className="h-4 w-4" />
              <span>{submitting ? "Grading Test..." : "Submit Mock Test"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Safe Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-h3 text-foreground">Leave Mock Test?</DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              Are you sure you want to exit? The timer will continue running in the background until the configured test duration expires.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              className="min-h-[44px]"
            >
              Resume Test
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => router.push("/app/mock-tests")}
              className="min-h-[44px]"
            >
              Exit to Hub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
