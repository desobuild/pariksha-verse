"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  Atom,
  Banknote,
  CalendarDays,
  Check,
  ClipboardList,
  Cog,
  GraduationCap,
  Info,
  Landmark,
  Loader2,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { BRAND } from "@/config/brand";
import {
  listAvailableExams,
  listExamAttempts,
  type AvailableExam,
  type ExamAttemptOption,
} from "@/domain/exam-catalog";
import { BrandMark } from "@/components/shared/brand-mark";
import { IconTile } from "@/components/shared/icon-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EXAM_ICONS: Record<string, LucideIcon> = {
  neet: Stethoscope,
  jee: Atom,
  upsc: Landmark,
  ssc: ClipboardList,
  gate: Cog,
  cat: TrendingUp,
  cuet: GraduationCap,
  banking: Banknote,
};

type LoadStatus = "loading" | "ready" | "error";

function formatExamDate(date: Date | null): string {
  if (!date) return "Date to be announced";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ExamSelectPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<LoadStatus>("loading");
  const [exams, setExams] = React.useState<AvailableExam[]>([]);

  const [selectedExam, setSelectedExam] = React.useState<AvailableExam | null>(null);
  const [attempts, setAttempts] = React.useState<ExamAttemptOption[]>([]);
  const [attemptStatus, setAttemptStatus] = React.useState<LoadStatus>("loading");
  const [selectedAttempt, setSelectedAttempt] = React.useState<ExamAttemptOption | null>(null);

  React.useEffect(() => {
    try {
      const available = listAvailableExams();
      setExams(available);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  const chooseExam = React.useCallback((exam: AvailableExam) => {
    if (!exam.isSupported) return;
    setSelectedExam(exam);
    setSelectedAttempt(null);
    setAttemptStatus("loading");
    try {
      const options = listExamAttempts(exam.slug);
      setAttempts(options);
      // Single-attempt exams resolve deterministically without an extra tap
      if (options.length === 1) setSelectedAttempt(options[0]);
      setAttemptStatus("ready");
    } catch {
      setAttempts([]);
      setAttemptStatus("error");
    }
  }, []);

  const supportedExams = exams.filter((e) => e.isSupported);
  const comingSoonExams = exams.filter((e) => !e.isSupported);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center border-b border-border-subtle bg-surface px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to landing"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Link>
        <div className="flex items-center gap-2 mx-auto pr-8 sm:pr-0">
          <BrandMark size={28} />
          <span className="font-bold tracking-tight text-foreground">{BRAND.name}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-6 sm:px-6">
        <div className="space-y-1.5">
          <h1 className="type-h1">Choose Your Exam</h1>
          <p className="type-body text-muted-foreground">
            Select the exam you are preparing for. We will customize your entire experience.
          </p>
        </div>

        {/* Exam grid */}
        {status === "loading" ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading exams…
          </div>
        ) : status === "error" ? (
          <div
            role="alert"
            className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-surface/50 p-10 text-center"
          >
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Could not load exams</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : supportedExams.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted-foreground">
            No supported exams are available yet. Check back soon.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4" role="radiogroup" aria-label="Available exams">
            {[...supportedExams, ...comingSoonExams].map((exam) => {
              const Icon = EXAM_ICONS[exam.slug] ?? GraduationCap;
              const isSelected = selectedExam?.slug === exam.slug;
              const cardClasses = [
                "relative flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
                exam.isSupported
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : "opacity-70",
                isSelected
                  ? "border-primary bg-surface shadow-card"
                  : exam.isSupported
                    ? "border-border/60 bg-surface shadow-card hover:border-primary/50"
                    : "border-border/60 bg-surface shadow-card",
              ].join(" ");

              const body = (
                <>
                  {isSelected && (
                    <span
                      className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  <IconTile variant={exam.isSupported ? "tint" : "strong"} size="md">
                    <Icon className="h-5 w-5" />
                  </IconTile>
                  <div className="space-y-0.5">
                    <p className="text-[15px] font-semibold leading-tight text-foreground">
                      {exam.shortName}
                    </p>
                    <p className="text-xs leading-tight text-foreground-subtle">{exam.category}</p>
                  </div>
                  <span
                    className={
                      exam.isSupported
                        ? "mt-auto inline-flex w-fit items-center rounded-full bg-surface-tint px-2.5 py-1 text-[11px] font-medium text-primary"
                        : "mt-auto inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground-subtle"
                    }
                  >
                    {exam.isSupported ? "Available" : "Coming soon"}
                  </span>
                </>
              );

              return exam.isSupported ? (
                <button
                  key={exam.slug}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={cardClasses}
                  onClick={() => chooseExam(exam)}
                >
                  {body}
                </button>
              ) : (
                <div
                  key={exam.slug}
                  aria-disabled="true"
                  className={cardClasses}
                  title={`${exam.shortName} curriculum is coming soon`}
                >
                  {body}
                </div>
              );
            })}
          </div>
        )}

        {/* Attempt selection */}
        {selectedExam && (
          <section aria-label="Choose attempt" className="mt-8">
            <h2 className="type-h4 mb-3">Choose Your Attempt</h2>
            {attemptStatus === "loading" ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading attempts…
              </div>
            ) : attemptStatus === "error" ? (
              <div role="alert" className="rounded-2xl border border-dashed border-destructive/40 bg-surface/50 p-8 text-center">
                <p className="text-sm font-medium text-foreground">Could not load attempts</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => chooseExam(selectedExam)}
                >
                  Try again
                </Button>
              </div>
            ) : attempts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted-foreground">
                No attempts are published for {selectedExam.shortName} yet.
              </div>
            ) : (
              <div role="radiogroup" aria-label={`${selectedExam.shortName} attempts`} className="space-y-3">
                {attempts.map((attempt) => {
                  const isSelected = selectedAttempt?.id === attempt.id;
                  return (
                    <button
                      key={attempt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedAttempt(attempt)}
                      className={[
                        "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary bg-surface shadow-card"
                          : "border-border/60 bg-surface shadow-card hover:border-primary/50",
                      ].join(" ")}
                    >
                      <IconTile variant={isSelected ? "strong" : "tint"} size="md">
                        <CalendarDays className="h-5 w-5" />
                      </IconTile>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {attempt.label}
                          </span>
                          {attempt.isProvisional && <Badge variant="primary">Provisional syllabus</Badge>}
                        </span>
                        <span className="mt-1 block text-xs text-foreground-subtle">
                          Exam on {formatExamDate(attempt.examDate)} · {attempt.status}
                        </span>
                        {attempt.isProvisional && attempt.provisionalNotice && (
                          <span className="mt-2.5 flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            {attempt.provisionalNotice}
                          </span>
                        )}
                      </span>
                      <span
                        aria-hidden="true"
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        ].join(" ")}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* CTA */}
        <div className="mt-auto pt-8">
          <Button
            size="lg"
            className="w-full font-semibold"
            disabled={!selectedExam || !selectedAttempt}
            onClick={() => {
              if (selectedAttempt) {
                router.push(`/exam/personalize?attempt=${encodeURIComponent(selectedAttempt.id)}`);
              }
            }}
          >
            {selectedAttempt ? `Continue with ${selectedAttempt.label}` : "Select an exam to continue"}
          </Button>
          <p className="mt-3 text-center text-xs text-foreground-subtle">
            Other exams launch as their verified syllabi are added.
          </p>
        </div>
      </main>
    </div>
  );
}
