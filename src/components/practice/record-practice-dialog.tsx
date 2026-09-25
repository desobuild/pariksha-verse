"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordPracticeSession,
  formatAccuracy,
  calculateAccuracyBps,
  type PracticeType,
} from "@/domain/practice";
import {
  getTopicMetadata,
  getSubjectTaxonomySummary,
} from "@/domain/dashboard";
import { useRepositories } from "@/repositories/repository-provider";
import { neetSeedData } from "@/db/seeds/data/neet";

export interface RecordPracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopicId?: string | null;
  examAttemptId: string;
  workspaceId: string;
  onSuccess?: () => void;
}

export function RecordPracticeDialog({
  open,
  onOpenChange,
  initialTopicId,
  examAttemptId,
  workspaceId,
  onSuccess,
}: RecordPracticeDialogProps) {
  const repos = useRepositories();

  // Cascading syllabus state
  const [selectedSubjectSlug, setSelectedSubjectSlug] = React.useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("");

  // Form values
  const [questionsAttempted, setQuestionsAttempted] = React.useState<string>("20");
  const [correctAnswers, setCorrectAnswers] = React.useState<string>("15");
  const [durationMinutes, setDurationMinutes] = React.useState<string>("30");
  const [sessionType, setSessionType] = React.useState<PracticeType>("focused");

  // State
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    attempted: number;
    correct: number;
    accuracyBps: number;
  } | null>(null);

  // Subject taxonomy
  const subjects = React.useMemo(
    () => getSubjectTaxonomySummary(examAttemptId),
    [examAttemptId]
  );

  // Chapters for selected subject
  const availableChapters = React.useMemo(() => {
    if (!selectedSubjectSlug) return [];
    const subj = neetSeedData.subjects.find((s) => s.slug === selectedSubjectSlug);
    if (!subj) return [];
    const subjectId = `${neetSeedData.exam.id}_${subj.slug}`;
    return subj.chapters.map((c) => ({
      id: `${subjectId}_${c.slug}`,
      name: c.name,
      slug: c.slug,
      topics: c.topics.map((t) => ({
        id: `${subjectId}_${c.slug}_${t.slug}`,
        name: t.name,
        slug: t.slug,
      })),
    }));
  }, [selectedSubjectSlug]);

  // Topics for selected chapter
  const availableTopics = React.useMemo(() => {
    if (!selectedChapterId) return [];
    const chap = availableChapters.find((c) => c.id === selectedChapterId);
    return chap?.topics || [];
  }, [availableChapters, selectedChapterId]);

  // Metadata of currently selected topic
  const selectedMeta = React.useMemo(() => {
    if (!selectedTopicId) return null;
    return getTopicMetadata(selectedTopicId, examAttemptId);
  }, [selectedTopicId, examAttemptId]);

  // Pre-fill when opened or initialTopicId changes
  React.useEffect(() => {
    if (!open) {
      setSuccessInfo(null);
      setErrorMessage(null);
      return;
    }

    if (initialTopicId) {
      const meta = getTopicMetadata(initialTopicId, examAttemptId);
      if (meta) {
        setSelectedSubjectSlug(meta.subjectSlug);
        setSelectedChapterId(meta.chapterId);
        setSelectedTopicId(meta.topicId);
        return;
      }
    }

    // Default to first subject if none selected
    if (!selectedSubjectSlug && subjects.length > 0) {
      setSelectedSubjectSlug(subjects[0].slug);
    }
  }, [open, initialTopicId, examAttemptId, subjects, selectedSubjectSlug]);

  // Auto-select first chapter when subject changes if current chapter is invalid
  React.useEffect(() => {
    if (availableChapters.length > 0) {
      const exists = availableChapters.some((c) => c.id === selectedChapterId);
      if (!exists) {
        setSelectedChapterId(availableChapters[0].id);
      }
    } else {
      setSelectedChapterId("");
    }
  }, [availableChapters, selectedChapterId]);

  // Auto-select first topic when chapter changes if current topic is invalid
  React.useEffect(() => {
    if (availableTopics.length > 0) {
      const exists = availableTopics.some((t) => t.id === selectedTopicId);
      if (!exists) {
        setSelectedTopicId(availableTopics[0].id);
      }
    } else {
      setSelectedTopicId("");
    }
  }, [availableTopics, selectedTopicId]);

  // Live calculation & validation
  const numAttempted = parseInt(questionsAttempted, 10);
  const numCorrect = parseInt(correctAnswers, 10);
  const numDuration = parseInt(durationMinutes, 10) || 0;

  const isAttemptedValid = !isNaN(numAttempted) && numAttempted >= 1;
  const isCorrectValid = !isNaN(numCorrect) && numCorrect >= 0;
  const isRangeValid = isAttemptedValid && isCorrectValid && numCorrect <= numAttempted;
  const isTopicSelected = Boolean(selectedTopicId);

  const formValid = isTopicSelected && isRangeValid;

  const currentAccuracyBps = isRangeValid
    ? calculateAccuracyBps(numCorrect, numAttempted)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await recordPracticeSession(repos, {
        workspaceId,
        topicId: selectedTopicId,
        questionsAttempted: numAttempted,
        correctAnswers: numCorrect,
        durationMinutes: numDuration,
        sessionType,
        completedAt: new Date(),
      });

      setSuccessInfo({
        attempted: numAttempted,
        correct: numCorrect,
        accuracyBps: result.accuracyBps,
      });

      if (onSuccess) {
        onSuccess();
      }

      // Automatically close after a friendly delay
      setTimeout(() => {
        onOpenChange(false);
      }, 3500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record practice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" aria-hidden="true" />
            <DialogTitle className="text-lg font-bold">Record Practice</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Log completed practice questions to update your topic accuracy and performance tracking.
          </DialogDescription>
        </DialogHeader>

        {successInfo ? (
          <div className="py-6 text-center space-y-3" role="status">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Practice recorded.</p>
              <p className="mt-1 text-sm text-foreground-subtle">
                {successInfo.correct} / {successInfo.attempted} correct ·{" "}
                <span className="font-semibold text-primary">
                  {formatAccuracy(successInfo.accuracyBps)}
                </span>{" "}
                accuracy
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="mt-2"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Subject Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="practice-subject" className="text-xs font-semibold">
                Subject
              </Label>
              <select
                id="practice-subject"
                value={selectedSubjectSlug}
                onChange={(e) => {
                  setSelectedSubjectSlug(e.target.value);
                }}
                className="w-full min-h-[44px] rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {subjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="practice-chapter" className="text-xs font-semibold">
                Chapter
              </Label>
              <select
                id="practice-chapter"
                value={selectedChapterId}
                onChange={(e) => {
                  setSelectedChapterId(e.target.value);
                }}
                disabled={availableChapters.length === 0}
                className="w-full min-h-[44px] rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {availableChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="practice-topic" className="text-xs font-semibold">
                Topic
              </Label>
              <select
                id="practice-topic"
                value={selectedTopicId}
                onChange={(e) => {
                  setSelectedTopicId(e.target.value);
                }}
                disabled={availableTopics.length === 0}
                className="w-full min-h-[44px] rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {availableTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Topic Summary Card */}
            {selectedMeta && (
              <div className="rounded-xl border border-border-subtle bg-surface-tint/30 p-3 text-xs">
                <p className="font-semibold text-foreground">{selectedMeta.topicName}</p>
                <p className="mt-0.5 text-foreground-subtle">
                  {selectedMeta.subjectName} · {selectedMeta.chapterName}
                </p>
              </div>
            )}

            {/* Numbers: Attempted & Correct */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="questions-attempted" className="text-xs font-semibold">
                  Attempted <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="questions-attempted"
                  type="number"
                  min="1"
                  step="1"
                  value={questionsAttempted}
                  onChange={(e) => setQuestionsAttempted(e.target.value)}
                  className="min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="correct-answers" className="text-xs font-semibold">
                  Correct <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="correct-answers"
                  type="number"
                  min="0"
                  max={questionsAttempted}
                  step="1"
                  value={correctAnswers}
                  onChange={(e) => setCorrectAnswers(e.target.value)}
                  className="min-h-[44px]"
                  required
                />
              </div>
            </div>

            {/* Validation Feedback */}
            {!isAttemptedValid && questionsAttempted !== "" && (
              <p className="text-xs text-destructive font-medium" role="alert">
                Questions attempted must be at least 1.
              </p>
            )}
            {isAttemptedValid && !isCorrectValid && correctAnswers !== "" && (
              <p className="text-xs text-destructive font-medium" role="alert">
                Correct answers must be 0 or more.
              </p>
            )}
            {isAttemptedValid && isCorrectValid && numCorrect > numAttempted && (
              <p className="text-xs text-destructive font-medium" role="alert">
                Correct answers cannot exceed questions attempted.
              </p>
            )}

            {/* Live Accuracy Preview */}
            {isRangeValid && (
              <div className="rounded-lg bg-surface-tint/50 px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-foreground-subtle">Calculated Accuracy:</span>
                <span className="font-semibold text-foreground">
                  {numCorrect} / {numAttempted} · {formatAccuracy(currentAccuracyBps)}
                </span>
              </div>
            )}

            {/* Duration & Practice Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration-minutes" className="text-xs font-semibold">
                  Duration (mins)
                </Label>
                <Input
                  id="duration-minutes"
                  type="number"
                  min="0"
                  step="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="min-h-[44px]"
                  placeholder="30"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="practice-type" className="text-xs font-semibold">
                  Practice Type
                </Label>
                <select
                  id="practice-type"
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as PracticeType)}
                  className="w-full min-h-[44px] rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="focused">Focused</option>
                  <option value="revision">Revision</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <p className="text-xs text-destructive font-medium" role="alert">
                {errorMessage}
              </p>
            )}

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formValid || submitting}
                className="min-h-[44px] font-semibold gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save Practice
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
