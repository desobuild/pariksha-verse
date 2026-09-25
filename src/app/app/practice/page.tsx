import { Suspense } from "react";
import { PracticeWorkspace } from "@/components/practice/practice-workspace";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageContainer } from "@/components/navigation/page-container";

/**
 * Practice & Performance Tracking (Phase 9):
 * Record question attempts, calculate accuracy in basis points,
 * detect weak topics (<60% accuracy), and feed performance back
 * into Today's Focus and study preparation.
 *
 * Suspense satisfies the Next.js 15 requirement for useSearchParams
 * during static page generation.
 */
export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-6 sm:py-8">
          <LoadingSkeleton count={4} />
        </PageContainer>
      }
    >
      <PracticeWorkspace />
    </Suspense>
  );
}
