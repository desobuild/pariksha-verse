"use client";

import * as React from "react";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import type { MockTestDetail, MockTestResultDetail } from "@/domain/mock-engine";
import { MockList } from "./mock-list";

export function MockWorkspace() {
  const { workspace, status } = useActiveWorkspace();
  const workspaceLoading = status === "loading";
  const repos = useRepositories();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mockTests, setMockTests] = React.useState<MockTestDetail[]>([]);
  const [results, setResults] = React.useState<MockTestResultDetail[]>([]);

  React.useEffect(() => {
    if (!workspace) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [tests, resList] = await Promise.all([
          repos.mock.getMockTests(workspace!.id),
          repos.mock.getAllResultsForWorkspace(workspace!.id),
        ]);

        if (isMounted) {
          setMockTests(tests);
          setResults(resList);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load mock tests");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [workspace, repos.mock]);

  if (workspaceLoading || (loading && !mockTests.length)) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="type-h1">Mock Tests</h1>
          <p className="mt-1 type-body text-muted-foreground">
            Simulate the real thing, then learn from every attempt.
          </p>
        </div>
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <ErrorState
          title="Error Loading Mock Tests"
          message={error}
          onRetry={() => {
            if (workspace) {
              repos.mock.getMockTests(workspace.id).then(setMockTests);
              repos.mock.getAllResultsForWorkspace(workspace.id).then(setResults);
            }
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="type-h1">Mock Tests</h1>
        <p className="mt-1 type-body text-muted-foreground">
          Simulate the real exam under strict timing and scoring rules, then learn from every attempt.
        </p>
      </div>

      <MockList
        mockTests={mockTests}
        results={results}
        workspaceId={workspace?.id || ""}
      />
    </PageContainer>
  );
}
