"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Play,
  RotateCcw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { useRepositories } from "@/repositories/repository-provider";
import type { MockTestDetail } from "@/domain/mock-engine";
import { validateMockQuestionPool } from "@/domain/mock-engine/selection";
import type { QuestionWithOptions } from "@/domain/practice-engine/types";

export interface MockInstructionsViewProps {
  mockTest: MockTestDetail;
  workspaceId: string;
  poolQuestions: QuestionWithOptions[];
  existingSessionId?: string | null;
}

export function MockInstructionsView({
  mockTest,
  workspaceId,
  poolQuestions,
  existingSessionId,
}: MockInstructionsViewProps) {
  const router = useRouter();
  const repos = useRepositories();
  const [starting, setStarting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Authoritative pool validation
  const validation = React.useMemo(() => {
    return validateMockQuestionPool(poolQuestions, mockTest);
  }, [poolQuestions, mockTest]);

  const maxMarks = mockTest.totalQuestions * mockTest.markingScheme.correctMarks;

  const handleStartOrResume = async () => {
    if (!validation.valid && !existingSessionId) {
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const session = await repos.mock.createSession({
        workspaceId,
        mockTestId: mockTest.id,
      });

      router.push(`/app/mock-tests/${mockTest.id}/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start mock session");
      setStarting(false);
    }
  };

  return (
    <PageContainer className="pt-6 sm:pt-8 max-w-4xl" size="default">
      {/* 1. Header & Navigation */}
      <div className="mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Link href="/app/mock-tests">
            <ArrowLeft className="h-4 w-4" />
            <span>All Mock Tests</span>
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            {mockTest.provenance === "fixture" ? "Sample Mock" : "Practice Mock"}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-muted text-muted-foreground">
            {mockTest.type.replace("_", " ")}
          </span>
        </div>

        <h1 className="type-h1">{mockTest.title}</h1>
        {mockTest.description && (
          <p className="mt-2 type-body text-muted-foreground leading-relaxed max-w-2xl">
            {mockTest.description}
          </p>
        )}
      </div>

      {/* 2. Key Specifications */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Card className="p-4 text-center">
          <span className="text-2xl font-bold text-foreground block">
            {mockTest.totalQuestions}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Questions
          </span>
        </Card>

        <Card className="p-4 text-center">
          <span className="text-2xl font-bold text-foreground block">
            {mockTest.durationMinutes}m
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Duration
          </span>
        </Card>

        <Card className="p-4 text-center">
          <span className="text-2xl font-bold text-foreground block">
            {maxMarks}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Maximum Marks
          </span>
        </Card>

        <Card className="p-4 text-center">
          <span className="text-2xl font-bold text-foreground block">
            +{mockTest.markingScheme.correctMarks} / -{mockTest.markingScheme.incorrectPenalty}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Marking Scheme
          </span>
        </Card>
      </div>

      {/* 3. Insufficient Question Warning (if applicable) */}
      {!validation.valid && (
        <Card className="mb-8 p-5 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold">
                Insufficient Question Bank Content
              </h2>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                {validation.reason ||
                  `This mock test requires ${validation.requiredCount} questions, but only ${validation.availableCount} active questions are available in the question bank.`}
              </p>
              {validation.missingSections && validation.missingSections.length > 0 && (
                <ul className="mt-2 text-xs list-disc list-inside space-y-0.5">
                  {validation.missingSections.map((s, idx) => (
                    <li key={idx}>
                      <strong>{s.sectionName}:</strong> Requires {s.required}, found {s.available}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Error alert */}
      {error && (
        <Card className="mb-6 p-4 bg-destructive/10 border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </Card>
      )}

      {/* 4. Section Structure */}
      {mockTest.sections && mockTest.sections.length > 0 && (
        <div className="mb-8">
          <SectionHeader
            title="Section Breakdown"
            description="Questions are partitioned into predefined subject/topic sections."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mockTest.sections.map((sec) => (
              <Card key={sec.id} className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">{sec.name}</span>
                </div>
                {sec.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                    {sec.description}
                  </p>
                )}
                <div className="text-xs font-semibold text-foreground/80 flex items-center justify-between pt-2 border-t border-border">
                  <span>Allocation:</span>
                  <span>{sec.questionCount} Questions</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. Exam Simulation Instructions */}
      <div className="mb-8">
        <SectionHeader
          title="Exam Simulation Instructions"
          description="Please read the test guidelines carefully before beginning."
        />
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div className="text-xs sm:text-sm">
              <strong className="text-foreground">Authoritative Countdown Timer:</strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                The timer begins the moment you click Start. It runs continuously and survives page refreshes based on authoritative timestamps.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div className="text-xs sm:text-sm">
              <strong className="text-foreground">Navigation &amp; Question Palette:</strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                You can freely navigate between questions and sections using the Previous/Next buttons or directly jumping via the Question Palette.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div className="text-xs sm:text-sm">
              <strong className="text-foreground">Marking Scheme &amp; Scoring:</strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                Each correct answer awards +{mockTest.markingScheme.correctMarks} marks. Each incorrect answer incurs a penalty of -{mockTest.markingScheme.incorrectPenalty} marks. Unanswered questions receive {mockTest.markingScheme.unansweredMarks} marks.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <div className="text-xs sm:text-sm">
              <strong className="text-foreground">Mark for Review:</strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                You can flag any question for review. At final submission, questions marked for review that have an answer selected WILL be evaluated and scored normally.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              5
            </span>
            <div className="text-xs sm:text-sm">
              <strong className="text-foreground">Automatic Submission on Expiry:</strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                When the timer reaches 00:00, the test will automatically submit with your current answers preserved. No further answers can be accepted once time expires.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 6. Sticky / Bottom Action Bar */}
      <div className="p-4 sm:p-5 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="text-xs text-muted-foreground">
          {existingSessionId ? (
            <span className="text-primary font-semibold flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" />
              You have an active in-progress session for this mock.
            </span>
          ) : (
            <span>Ready to simulate the exam under real time constraints?</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            className="min-h-[44px] text-xs font-semibold"
          >
            <Link href="/app/mock-tests">Cancel</Link>
          </Button>

          <Button
            onClick={handleStartOrResume}
            disabled={(!validation.valid && !existingSessionId) || starting}
            className="min-h-[44px] px-6 text-xs sm:text-sm font-semibold gap-2 shadow-sm"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>
              {starting
                ? "Launching Simulation..."
                : existingSessionId
                ? "Resume Mock Test"
                : "Start Mock Test"}
            </span>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
