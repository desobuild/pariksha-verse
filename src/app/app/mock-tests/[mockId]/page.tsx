"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import type { MockTestDetail } from "@/domain/mock-engine";
import type { QuestionWithOptions } from "@/domain/practice-engine/types";
import { MockInstructionsView } from "@/components/mock-tests/mock-instructions-view";

export default function MockTestDetailPage() {
  const params = useParams();
  const mockId = params?.mockId as string;
  const router = useRouter();

  const { workspace, status } = useActiveWorkspace();
  const workspaceLoading = status === "loading";
  const repos = useRepositories();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mockTest, setMockTest] = React.useState<MockTestDetail | null>(null);
  const [poolQuestions, setPoolQuestions] = React.useState<QuestionWithOptions[]>([]);

  React.useEffect(() => {
    if (!workspace || !mockId) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [test, allQuestions] = await Promise.all([
          repos.mock.getMockTestById(mockId, workspace!.id),
          repos.question.getAllQuestions(),
        ]);

        if (!test) {
          throw new Error("Mock test not found");
        }

        if (isMounted) {
          setMockTest(test);
          setPoolQuestions(allQuestions);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load mock test details");
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
  }, [workspace, mockId, repos.mock, repos.question]);

  if (workspaceLoading || loading) {
    return (
      <PageContainer className="py-6 sm:py-8 max-w-4xl">
        <LoadingSkeleton count={5} />
      </PageContainer>
    );
  }

  if (error || !mockTest) {
    return (
      <PageContainer className="py-6 sm:py-8 max-w-4xl">
        <ErrorState
          title="Mock Test Unavailable"
          message={error || "Mock test could not be found."}
          onRetry={() => router.push("/app/mock-tests")}
        />
      </PageContainer>
    );
  }

  return (
    <MockInstructionsView
      mockTest={mockTest}
      workspaceId={workspace?.id || ""}
      poolQuestions={poolQuestions}
    />
  );
}
