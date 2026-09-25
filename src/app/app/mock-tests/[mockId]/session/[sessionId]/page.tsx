"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/navigation/page-container";
import { ErrorState } from "@/components/shared/error-state";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import type { MockTestSessionDetail } from "@/domain/mock-engine";
import { MockExamPlayer } from "@/components/mock-tests/mock-exam-player";

export default function MockExamSessionPage() {
  const params = useParams();
  const mockId = params?.mockId as string;
  const sessionId = params?.sessionId as string;
  const router = useRouter();

  const { workspace, status } = useActiveWorkspace();
  const workspaceLoading = status === "loading";
  const repos = useRepositories();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<MockTestSessionDetail | null>(null);

  React.useEffect(() => {
    if (!workspace || !sessionId) return;
    let isMounted = true;

    async function loadSession() {
      try {
        setLoading(true);
        setError(null);

        const sess = await repos.mock.getSession(sessionId, workspace!.id);
        if (!sess) {
          throw new Error("Mock test session not found");
        }

        // If session was completed or auto-submitted, redirect to result
        if (sess.status === "completed" || sess.status === "auto_submitted") {
          router.replace(`/app/mock-tests/${mockId}/session/${sessionId}/result`);
          return;
        }

        if (isMounted) {
          setSession(sess);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load mock session");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [workspace, sessionId, mockId, repos.mock, router]);

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <PageContainer className="py-6 sm:py-8 max-w-2xl">
        <ErrorState
          title="Session Unavailable"
          message={error || "Could not retrieve the requested mock test session."}
          onRetry={() => router.push(`/app/mock-tests/${mockId}`)}
        />
      </PageContainer>
    );
  }

  return <MockExamPlayer initialSession={session} workspaceId={workspace?.id || ""} />;
}
