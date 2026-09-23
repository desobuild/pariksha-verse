"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Clock,
  Info,
  Loader2,
  Target,
} from "lucide-react";
import { BRAND } from "@/config/brand";
import {
  getExamAttempt,
  getExamForAttempt,
} from "@/domain/exam-catalog";
import {
  PREPARATION_STAGES,
  STUDY_GOAL_MAX,
  STUDY_GOAL_MIN,
  STUDY_GOAL_OPTIONS,
  formatStudyGoal,
  onboardingSchema,
  type PreparationStage,
} from "@/domain/preparation";
import { useRepositories } from "@/repositories/repository-provider";
import { BrandMark } from "@/components/shared/brand-mark";
import { IconTile } from "@/components/shared/icon-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

function PersonalizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repos = useRepositories();

  const attemptId = searchParams.get("attempt") ?? "";
  const attempt = React.useMemo(() => getExamAttempt(attemptId), [attemptId]);
  const exam = React.useMemo(() => getExamForAttempt(attemptId), [attemptId]);

  const [goalMinutes, setGoalMinutes] = React.useState<number | null>(120);
  const [customGoal, setCustomGoal] = React.useState("");
  const [stage, setStage] = React.useState<PreparationStage | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isCustomGoal = goalMinutes !== null && !STUDY_GOAL_OPTIONS.some((o) => o.minutes === goalMinutes);
  const effectiveGoal = isCustomGoal ? goalMinutes : goalMinutes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!attempt) return;
    if (effectiveGoal === null) {
      setError("Choose a daily study goal to continue.");
      return;
    }
    if (!stage) {
      setError("Choose your current preparation stage to continue.");
      return;
    }

    const parsed = onboardingSchema.safeParse({
      examAttemptId: attempt.id,
      dailyStudyGoalMinutes: effectiveGoal,
      preparationStage: stage,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please review your choices.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Persist preferences (daily goal + preparation stage)
      await repos.preferences.saveUserPreferences({
        dailyStudyGoalMinutes: parsed.data.dailyStudyGoalMinutes,
        preparationStage: parsed.data.preparationStage,
      });

      // 2. Find-or-create the workspace (deterministic duplicate prevention),
      //    established as the active workspace.
      await repos.workspace.ensureWorkspaceForAttempt(parsed.data.examAttemptId);

      // 3. Enter the preparation space
      router.push("/app/home");
    } catch {
      setError(
        "We could not finish setting up your preparation space. Please try again — nothing was duplicated."
      );
      setSubmitting(false);
    }
  };

  if (!attempt) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 py-16 text-center sm:px-6">
        <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 type-h3">Attempt not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This preparation link is no longer valid. Pick your exam and attempt again.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-6 font-semibold">
          <Link href="/exam/select">Back to exam selection</Link>
        </Button>
      </main>
    );
  }

  const examDate = attempt.examDate
    ? attempt.examDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Date to be announced";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <h1 className="type-h1">Personalize Preparation</h1>
        <p className="type-body text-muted-foreground">
          Two quick choices and your preparation space is ready.
        </p>
      </div>

      {/* Target attempt summary */}
      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3.5">
          <IconTile variant="strong" size="lg">
            <CalendarCheck className="h-6 w-6" />
          </IconTile>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-foreground">{attempt.label}</p>
              {attempt.isProvisional && <Badge variant="primary">Provisional</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground-subtle">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Exam on {examDate}
              {exam ? ` · ${exam.shortName}` : null}
            </p>
            {attempt.isProvisional && attempt.provisionalNotice && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                {attempt.provisionalNotice}
              </p>
            )}
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} noValidate>
        {/* Daily study goal */}
        <fieldset className="mt-8">
          <legend className="type-h4 mb-1">Daily Study Goal</legend>
          <p className="mb-3 text-xs text-foreground-subtle">
            A realistic daily target you can sustain.
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Daily study goal">
            {STUDY_GOAL_OPTIONS.map((option) => {
              const selected = goalMinutes === option.minutes;
              return (
                <button
                  key={option.minutes}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setGoalMinutes(option.minutes);
                    setCustomGoal("");
                  }}
                  className={cn(
                    "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-subtle"
                      : "border-border bg-surface text-foreground hover:border-primary/40"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={isCustomGoal}
              onClick={() => setGoalMinutes(STUDY_GOAL_OPTIONS[STUDY_GOAL_OPTIONS.length - 1].minutes + 30)}
              className={cn(
                "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCustomGoal
                  ? "border-primary bg-primary text-primary-foreground shadow-subtle"
                  : "border-border bg-surface text-foreground hover:border-primary/40"
              )}
            >
              Custom
            </button>
          </div>
          {isCustomGoal && (
            <div className="mt-3 flex max-w-[220px] items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={STUDY_GOAL_MIN}
                max={STUDY_GOAL_MAX}
                value={customGoal}
                onChange={(e) => {
                  setCustomGoal(e.target.value);
                  const parsed = Number.parseInt(e.target.value, 10);
                  setGoalMinutes(Number.isFinite(parsed) ? parsed : null);
                }}
                aria-label="Custom daily study goal in minutes"
                placeholder={`${STUDY_GOAL_MIN}–${STUDY_GOAL_MAX}`}
              />
              <span className="text-xs text-foreground-subtle">min / day</span>
            </div>
          )}
          <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">
            {effectiveGoal ? `Daily goal: ${formatStudyGoal(effectiveGoal)}` : "Pick a goal above"}
          </p>
        </fieldset>

        {/* Preparation stage */}
        <fieldset className="mt-8">
          <legend className="type-h4 mb-1">Current Stage</legend>
          <p className="mb-3 text-xs text-foreground-subtle">
            Where are you right now? This shapes how your plan starts.
          </p>
          <div role="radiogroup" aria-label="Current preparation stage" className="space-y-2.5">
            {PREPARATION_STAGES.map((option) => {
              const selected = stage === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStage(option.value)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-surface shadow-card"
                      : "border-border/60 bg-surface shadow-card hover:border-primary/40"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      selected ? "bg-surface-tint text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Target className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-foreground-subtle">
                      {option.description}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    {selected && (
                      <svg viewBox="0 0 8 8" className="h-2 w-2 fill-current">
                        <circle cx="4" cy="4" r="4" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="mt-8 pb-8">
          <Button type="submit" size="lg" className="w-full font-semibold" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Setting up your space…" : "Create My Preparation Space"}
          </Button>
          <p className="mt-3 text-center text-xs text-foreground-subtle">
            You can change your goal and stage anytime from More.
          </p>
        </div>
      </form>
    </main>
  );
}

export default function ExamPersonalizePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center border-b border-border-subtle bg-surface px-4 sm:px-6">
        <Link
          href="/exam/select"
          className="flex items-center gap-2 rounded-lg text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to exam selection"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Link>
        <div className="flex items-center gap-2 mx-auto pr-8 sm:pr-0">
          <BrandMark size={28} />
          <span className="font-bold tracking-tight text-foreground">{BRAND.name}</span>
        </div>
      </header>
      <React.Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        }
      >
        <PersonalizeContent />
      </React.Suspense>
    </div>
  );
}
