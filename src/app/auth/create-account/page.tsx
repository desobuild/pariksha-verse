"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { FormGroup, FormLabel, FormMessage } from "@/components/ui/form";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth/use-auth";
import { StagingDemoPanel } from "@/components/auth/staging-demo-panel";

export default function CreateAccountPage() {
  const router = useRouter();
  const { createAccount, verify, continueAsGuest, demoAuth, status } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    const res = await createAccount(email);
    setLoading(false);

    if (res.success) {
      setStep("verify");
      setSuccessMsg("Verification link sent! Check your email and enter your code to continue.");
    } else {
      setError(res.error || "Failed to create account.");
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !token) return;
    setLoading(true);
    setError(null);

    const res = await verify(email, token);
    setLoading(false);

    if (res.success) {
      router.push("/app/home");
    } else {
      setError(res.error || "Invalid or expired token.");
    }
  };

  const handleContinueAsGuest = async () => {
    await continueAsGuest();
    router.push("/app/home");
  };

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

        {demoAuth.enabled ? (
          // Staging demo authentication: no email requirements are shown.
          <StagingDemoPanel />
        ) : status === "loading" ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Checking your session…
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Sync your preparation progress across all your devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <FormMessage
                  error
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  {error}
                </FormMessage>
              )}
              {successMsg && (
                <div className="p-3 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium">
                  {successMsg}
                </div>
              )}

              {step === "request" ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <FormGroup>
                    <FormLabel htmlFor="email" required>
                      Email Address
                    </FormLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      error={!!error}
                    />
                  </FormGroup>
                  <Button type="submit" className="w-full" loading={loading}>
                    Create Account with Email
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleManualVerify} className="space-y-4">
                  <FormGroup>
                    <FormLabel htmlFor="token" required>
                      Verification Code / Token
                    </FormLabel>
                    <Input
                      id="token"
                      type="text"
                      placeholder="Paste verification token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                      error={!!error}
                    />
                  </FormGroup>
                  <Button type="submit" className="w-full" loading={loading}>
                    Confirm & Sign In
                  </Button>
                </form>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleContinueAsGuest}
              >
                Continue as Guest
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Privacy First: We collect only your email to sync your workspace. Zero
                advertisements, zero passwords stored.
              </p>
            </CardContent>
            <CardFooter className="justify-center border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Already have an account? </span>
              <Link
                href="/auth/sign-in"
                className="ml-1 text-primary hover:underline font-semibold"
              >
                Sign In
              </Link>
            </CardFooter>
          </Card>
        )}
      </PageContainer>
    </div>
  );
}
