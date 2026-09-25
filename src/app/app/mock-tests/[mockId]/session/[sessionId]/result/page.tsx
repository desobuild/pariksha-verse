"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import type { MockTestResultDetail } from "@/domain/mock-engine";
import { MockResultView } from "@/components/mock-tests/mock-result-view";

export default function MockTestResultPage() {
  const params = useParams();
  const mockId = params?.mockId as string;
  const sessionId = params?.sessionId as string;
  const router = useRouter();

  const { workspace, status } = useActiveWorkspace();
  const workspaceLoading = status === "loading";
  const repos = useRepositories();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<MockTestResultDetail | null>(null);

  React.useEffect(() => {
    if (!workspace || !sessionId) return;
    let isMounted = true;

    async function loadResult() {
      try {
        setLoading(true);
        setError(null);

        const res = await repos.mock.getResultBySessionId(sessionId, workspace!.id);
        if (!res) {
          throw new Error("Result not found for this mock test session");
        }

        if (isMounted) {
          setResult(res);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load test results");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadResult();

    return () => {
      isMounted = false;
    };
  }, [workspace, sessionId, repos.mock]);

  if (workspaceLoading || loading) {
    return (
      <PageContainer className="py-6 sm:py-8 max-w-4xl">
        <LoadingSkeleton count={5} />
      </PageContainer>
    );
  }

  if (error || !result) {
    return (
      <PageContainer className="py-6 sm:py-8 max-w-2xl">
        <ErrorState
          title="Result Unavailable"
          message={error || "Could not retrieve the mock test results."}
          onRetry={() => router.push(`/app/mock-tests/${mockId}`)}
        />
      </PageContainer>
    );
  }

  return <MockResultView result={result} />;
}
