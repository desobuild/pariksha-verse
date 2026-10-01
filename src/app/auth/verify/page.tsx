import { Suspense } from "react";
import type { Metadata } from "next";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { VerifyMagicLinkClient } from "./verify-client";

export const metadata: Metadata = {
  title: "Verifying sign-in",
};

/**
 * Magic-link verification landing page.
 *
 * Completes the LOCAL email-auth flow: the transactional email link built by
 * the sign-in / create-account APIs points here with `?token=…&email=…`, and
 * the client component below exchanges both through the existing
 * /api/auth/verify endpoint, which establishes the pv_session cookie. There is
 * deliberately no public signup, no additional email provider, and no second
 * session mechanism on this page.
 *
 * The workspace component reads the shareable `?token=` search param, so
 * Suspense satisfies the prerender requirement for useSearchParams in Next 15.
 */
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-6 sm:py-8" size="narrow">
          <LoadingSkeleton count={3} />
        </PageContainer>
      }
    >
      <VerifyMagicLinkClient />
    </Suspense>
  );
}
