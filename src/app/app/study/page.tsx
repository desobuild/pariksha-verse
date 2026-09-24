import { Suspense } from "react";
import { StudyWorkspace } from "@/components/study/study-workspace";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageContainer } from "@/components/navigation/page-container";

/**
 * Study & Syllabus navigator (Phase 7).
 * The workspace itself is a client component because it reads the shareable
 * `?subject=` search param; Suspense satisfies the prerender requirement
 * for useSearchParams in Next 15.
 */
export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-6 sm:py-8" size="wide">
          <LoadingSkeleton count={5} />
        </PageContainer>
      }
    >
      <StudyWorkspace />
    </Suspense>
  );
}
