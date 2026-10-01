"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth/use-auth";

type VerifyOutcome = "verifying" | "redirecting" | "failed" | "incomplete";

/**
 * Magic-link verification landing page (LOCAL email-auth testing).
 *
 * The transactional email link points here with `?token=…&email=…` (built by
 * POST /api/auth/sign-in and /api/auth/create-account). The page performs no
 * authentication of its own: it feeds both values into the existing
 * useAuth().verify() flow, which POSTs to /api/auth/verify where the server
 * validates the HMAC token and establishes the pv_session cookie.
 *
 * Token handling contract:
 * - never logged to the console,
 * - never written to localStorage/sessionStorage,
 * - never rendered back to the user,
 * - replaced in browser history via router.replace once consumed.
 */
export function VerifyMagicLinkClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, verify } = useAuth();

  const [outcome, setOutcome] = React.useState<VerifyOutcome>("verifying");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // StrictMode double-invokes effects; the verification attempt must run
  // exactly once per mounted link.
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (status === "loading" || attemptedRef.current) return;

    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      attemptedRef.current = true;
      // Nothing to verify: an already-authenticated visitor simply continues
      // into the app; everyone else gets the broken-link state.
      if (status === "authenticated") {
        setOutcome("redirecting");
        router.replace("/app/home");
      } else {
        setOutcome("incomplete");
      }
      return;
    }

    attemptedRef.current = true;
    void (async () => {
      try {
        const result = await verify(email, token);
        if (result.success) {
          // Session cookie is set by the verify API response; auth context has
          // already refreshed identity/guest migration. Replace (not push) so
          // the consumed token does not linger in history.
          setOutcome("redirecting");
          router.replace("/app/home");
        } else {
          setErrorMessage(result.error ?? null);
          setOutcome("failed");
        }
      } catch {
        setErrorMessage(null);
        setOutcome("failed");
      }
    })();
  }, [status, searchParams, verify, router]);

  const expiredOrInvalid =
    errorMessage !== null && /invalid|expired|token/i.test(errorMessage);

  return (
    <div className="min-h-dynamic bg-background flex flex-col py-12">
      <PageContainer size="narrow" className="my-auto">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-2 font-bold text-xl text-foreground"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              {BRAND.logo.mark}
            </div>
            <span>{BRAND.name}</span>
          </Link>
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <Card>
          {outcome === "verifying" && (
            <CardContent className="py-12 text-center">
              <Loader2
                className="mx-auto h-8 w-8 animate-spin text-primary"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm font-medium text-foreground" role="status">
                Verifying your sign-in link…
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checking your secure verification token.
              </p>
            </CardContent>
          )}

          {outcome === "redirecting" && (
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-foreground" role="status">
                Verification complete
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Taking you to your workspace…
              </p>
              <Button asChild variant="outline" className="mt-5 min-h-[44px]">
                <Link href="/app/home">Go to your workspace</Link>
              </Button>
            </CardContent>
          )}

          {outcome === "incomplete" && (
            <>
              <CardHeader>
                <div className="mb-2 flex justify-center">
                  <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
                </div>
                <CardTitle className="text-center">This sign-in link is incomplete</CardTitle>
                <CardDescription className="text-center">
                  The link is missing its verification details, so it cannot be used to sign in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full min-h-[44px]">
                  <Link href="/auth/sign-in">Return to Sign In</Link>
                </Button>
              </CardContent>
            </>
          )}

          {outcome === "failed" && (
            <>
              <CardHeader>
                <div className="mb-2 flex justify-center">
                  <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
                </div>
                <CardTitle className="text-center">Verification failed</CardTitle>
                <CardDescription className="text-center">
                  {expiredOrInvalid
                    ? "This sign-in link is invalid or has expired. Verification links expire after 15 minutes — request a fresh one to continue."
                    : "We couldn't verify your sign-in link. Please try signing in again."}
                </CardDescription>
              </CardHeader>
              {errorMessage && (
                <CardContent>
                  <p
                    role="alert"
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                  >
                    {errorMessage}
                  </p>
                </CardContent>
              )}
              <CardFooter className="flex-col gap-3">
                <Button asChild className="w-full min-h-[44px]">
                  <Link href="/auth/sign-in">Return to Sign In</Link>
                </Button>
              </CardFooter>
            </>
          )}
        </Card>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Requested a new link? It will arrive at the email address you signed in with.
        </p>
      </PageContainer>
    </div>
  );
}
