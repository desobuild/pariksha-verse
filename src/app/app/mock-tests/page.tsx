import { Suspense } from "react";
import { MockWorkspace } from "@/components/mock-tests/mock-workspace";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageContainer } from "@/components/navigation/page-container";

/**
 * Mock Tests & Exam Simulation (Phase 11):
 * Multi-section timed exam simulations with configurable negative marking,
 * question palette, mark-for-review state, authoritative countdown,
 * automatic submission upon expiry, and question review.
 */
export default function MockTestsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="type-h1">Mock Tests</h1>
            <p className="mt-1 type-body text-muted-foreground">
              Simulate the real thing, then learn from every attempt.
            </p>
          </div>
          <LoadingSkeleton count={4} />
        </PageContainer>
      }
    >
      <MockWorkspace />
    </Suspense>
  );
}
