"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Sparkles, BookOpen, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRepositories } from "@/repositories/repository-provider";
import {
  getTopicMetadata,
  getSubjectTaxonomySummary,
} from "@/domain/dashboard";
import { neetSeedData } from "@/db/seeds/data/neet";
import type { PracticeScope, PracticeScopeType } from "@/domain/practice-engine";

export interface StartPracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopicId?: string | null;
  examAttemptId: string;
  workspaceId: string;
}

const COUNT_OPTIONS = [5, 10, 20] as const;

export function StartPracticeDialog({
  open,
  onOpenChange,
  initialTopicId,
  examAttemptId,
  workspaceId,
}: StartPracticeDialogProps) {
  const router = useRouter();
  const repos = useRepositories();

  const [scopeType, setScopeType] = React.useState<PracticeScopeType>("topic");
  const [selectedSubjectSlug, setSelectedSubjectSlug] = React.useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("");
  const [questionCount, setQuestionCount] = React.useState<number>(10);

  const [availableCount, setAvailableCount] = React.useState<number | null>(null);
  const [checkingCount, setCheckingCount] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Subject taxonomy
  const subjects = React.useMemo(
    () => getSubjectTaxonomySummary(examAttemptId),
    [examAttemptId]
  );

  // Available chapters for selected subject
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

  // Available topics for selected chapter
  const availableTopics = React.useMemo(() => {
    if (!selectedChapterId) return [];
    const chap = availableChapters.find((c) => c.id === selectedChapterId);
    return chap?.topics || [];
  }, [availableChapters, selectedChapterId]);

  // Initialize or update selection when initialTopicId changes
  React.useEffect(() => {
    if (initialTopicId) {
      setScopeType("topic");
      const meta = getTopicMetadata(initialTopicId, examAttemptId);
      if (meta) {
        setSelectedSubjectSlug(meta.subjectSlug);
        setSelectedChapterId(meta.chapterId);
        setSelectedTopicId(meta.topicId);
      }
    } else if (!selectedSubjectSlug && subjects.length > 0) {
      setSelectedSubjectSlug(subjects[0].slug);
    }
  }, [initialTopicId, examAttemptId, subjects, selectedSubjectSlug]);

  // Construct active PracticeScope
  const activeScope = React.useMemo<PracticeScope | null>(() => {
    if (scopeType === "topic") {
      if (!selectedTopicId) return null;
      return { type: "topic", topicId: selectedTopicId };
    }
    if (scopeType === "subject") {
      if (!selectedSubjectSlug) return null;
      const subj = subjects.find((s) => s.slug === selectedSubjectSlug);
      const subjectId = subj?.id || `${neetSeedData.exam.id}_${selectedSubjectSlug}`;
      return { type: "subject", subjectId };
    }
    return { type: "mixed", examAttemptId };
  }, [scopeType, selectedTopicId, selectedSubjectSlug, examAttemptId, subjects]);

  // Query available question count for activeScope
  React.useEffect(() => {
    if (!open || !activeScope) {
      setAvailableCount(null);
      return;
    }

    let isMounted = true;
    setCheckingCount(true);
    repos.question
      .countQuestionsForScope({
        examId: "exam_neet",
        scope: activeScope,
      })
      .then((count) => {
        if (isMounted) setAvailableCount(count);
      })
      .catch(() => {
        if (isMounted) setAvailableCount(0);
      })
      .finally(() => {
        if (isMounted) setCheckingCount(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, activeScope, repos]);

  const handleStart = async () => {
    if (!activeScope) return;
    setError(null);
    setStarting(true);

    try {
      const session = await repos.questionSession.createSession({
        workspaceId,
        scope: activeScope,
        questionCount,
      });

      onOpenChange(false);
      router.push(`/app/practice/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start practice session");
      setStarting(false);
    }
  };

  const hasNoQuestions = availableCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">Practice Engine</span>
          </div>
          <DialogTitle className="type-h3 text-foreground">Start Question Practice</DialogTitle>
          <DialogDescription className="type-body text-muted-foreground">
            Solve questions with immediate feedback, detailed review, and automated performance tracking.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Scope Type Tabs */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Practice Scope
            </Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setScopeType("topic")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition-all ${
                  scopeType === "topic"
                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                <BookOpen className="h-4 w-4 mb-1" />
                Topic
              </button>
              <button
                type="button"
                onClick={() => setScopeType("subject")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition-all ${
                  scopeType === "subject"
                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                <Layers className="h-4 w-4 mb-1" />
                Subject
              </button>
              <button
                type="button"
                onClick={() => setScopeType("mixed")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition-all ${
                  scopeType === "mixed"
                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                <Sparkles className="h-4 w-4 mb-1" />
                Mixed (All)
              </button>
            </div>
          </div>

          {/* Cascading Scope Dropdowns */}
          {scopeType === "topic" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="topic-subject-select" className="text-xs font-medium text-foreground">
                  Subject
                </Label>
                <select
                  id="topic-subject-select"
                  value={selectedSubjectSlug}
                  onChange={(e) => {
                    setSelectedSubjectSlug(e.target.value);
                    setSelectedChapterId("");
                    setSelectedTopicId("");
                  }}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSubjectSlug && (
                <div>
                  <Label htmlFor="topic-chapter-select" className="text-xs font-medium text-foreground">
                    Chapter
                  </Label>
                  <select
                    id="topic-chapter-select"
                    value={selectedChapterId}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value);
                      setSelectedTopicId("");
                    }}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                  >
                    <option value="">Select chapter...</option>
                    {availableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedChapterId && (
                <div>
                  <Label htmlFor="topic-topic-select" className="text-xs font-medium text-foreground">
                    Topic
                  </Label>
                  <select
                    id="topic-topic-select"
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                  >
                    <option value="">Select topic...</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {scopeType === "subject" && (
            <div>
              <Label htmlFor="subject-only-select" className="text-xs font-medium text-foreground">
                Select Subject
              </Label>
              <select
                id="subject-only-select"
                value={selectedSubjectSlug}
                onChange={(e) => setSelectedSubjectSlug(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scopeType === "mixed" && (
            <div className="p-3 rounded-lg border bg-surface-tint/20 text-xs text-muted-foreground">
              Mixed practice selects questions across Physics, Chemistry, and Biology to test overall preparation breadth.
            </div>
          )}

          {/* Question Count Selection */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Question Count
            </Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`py-2 px-4 rounded-lg border text-sm font-semibold min-h-[44px] transition-all ${
                    questionCount === count
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  {count} Questions
                </button>
              ))}
            </div>
          </div>

          {/* Availability Status Notice */}
          <div className="pt-1">
            {checkingCount ? (
              <p className="text-xs text-muted-foreground">Checking question bank availability...</p>
            ) : availableCount !== null ? (
              hasNoQuestions ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">No questions currently in bank</span>
                    <p className="mt-0.5">
                      No verified questions are available for this specific scope yet. Please choose another topic or practice via Subject/Mixed mode.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    <strong>{availableCount}</strong> questions available in bank.
                    {availableCount < questionCount && (
                      <span className="text-amber-600 ml-1">
                        (Session will include all {availableCount} available)
                      </span>
                    )}
                  </span>
                </div>
              )
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
            disabled={starting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStart}
            disabled={starting || !activeScope || hasNoQuestions}
            className="min-h-[44px] gap-2 font-semibold shadow-sm"
          >
            <Play className="h-4 w-4" />
            {starting ? "Starting..." : "Start Practice Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
