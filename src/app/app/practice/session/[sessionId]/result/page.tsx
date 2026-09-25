"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import { QuestionResultView } from "@/components/practice/question-result-view";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/navigation/page-container";
import { gradeQuestionSession, type QuestionSessionResult } from "@/domain/practice-engine";
import { getTopicMetadata } from "@/domain/dashboard";

export default function QuestionSessionResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const { workspace, status } = useActiveWorkspace();
  const repos = useRepositories();

  const [result, setResult] = React.useState<QuestionSessionResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspace || !sessionId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    repos.questionSession
      .getSession(sessionId, workspace.id)
      .then((session) => {
        if (!isMounted) return;
        if (!session) {
          setError("Practice session not found.");
          return;
        }

        // Collect answers from attempts
        const answers: Record<string, string | null> = {};
        for (const att of session.attempts) {
          answers[att.questionId] = att.selectedOptionId;
        }

        const calculatedResult = gradeQuestionSession({
          sessionId: session.id,
          workspaceId: session.workspaceId,
          scopeType: session.scopeType,
          scopeId: session.scopeId,
          questions: session.questions,
          answers,
          durationSeconds: session.durationSeconds,
          completedAt: session.completedAt ?? new Date(),
          metadataResolver: (topicId) => getTopicMetadata(topicId),
        });

        setResult(calculatedResult);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load practice result.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId, workspace, repos]);

  const handlePracticeAgain = async () => {
    if (!result || !workspace) return;
    try {
      let scope;
      if (result.scopeType === "topic") {
        scope = { type: "topic" as const, topicId: result.scopeId };
      } else if (result.scopeType === "subject") {
        scope = { type: "subject" as const, subjectId: result.scopeId };
      } else {
        scope = { type: "mixed" as const, examAttemptId: result.scopeId };
      }

      const nextSession = await repos.questionSession.createSession({
        workspaceId: workspace.id,
        scope,
        questionCount: result.totalQuestions,
      });

      router.push(`/app/practice/session/${nextSession.id}`);
    } catch {
      router.push("/app/practice");
    }
  };

  if (status === "loading" || loading) {
    return (
      <PageContainer className="py-8">
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  if (error || !result) {
    return (
      <PageContainer className="py-8">
        <ErrorState
          title="Could not load practice result"
          message={error || "Result not found."}
          onRetry={() => router.push("/app/practice")}
        />
      </PageContainer>
    );
  }

  return (
    <QuestionResultView
      result={result}
      onPracticeAgain={handlePracticeAgain}
    />
  );
}
