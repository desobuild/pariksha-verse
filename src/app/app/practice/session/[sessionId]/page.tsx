"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import { QuestionPlayer } from "@/components/practice/question-player";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/navigation/page-container";
import type { QuestionSessionWithAttempts } from "@/domain/practice-engine";

export default function QuestionSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const { workspace, status } = useActiveWorkspace();
  const repos = useRepositories();

  const [session, setSession] = React.useState<QuestionSessionWithAttempts | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspace || !sessionId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    repos.questionSession
      .getSession(sessionId, workspace.id)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setError("Practice session not found.");
          return;
        }

        if (data.status === "completed") {
          router.replace(`/app/practice/session/${sessionId}/result`);
          return;
        }

        setSession(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load practice session.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId, workspace, repos, router]);

  if (status === "loading" || loading) {
    return (
      <PageContainer className="py-8">
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  if (error || !session || !workspace) {
    return (
      <PageContainer className="py-8">
        <ErrorState
          title="Could not load practice session"
          message={error || "Session not found."}
          onRetry={() => router.push("/app/practice")}
        />
      </PageContainer>
    );
  }

  return <QuestionPlayer initialSession={session} workspaceId={workspace.id} />;
}
