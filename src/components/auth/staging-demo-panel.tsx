"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/use-auth";

/**
 * Phase 13A.3 — Staging-only authentication panel.
 *
 * Rendered inside the auth pages (which supply the page layout and brand
 * header) instead of the email forms when the server reports that staging
 * demo authentication is enabled. Never shows email-registration requirements
 * and never exposes implementation details (no user IDs, emails, environment
 * variables, or auth internals).
 */
export function StagingDemoPanel() {
  const router = useRouter();
  const { demoAuth, demoSignIn, continueAsGuest } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(demoAuth.options[0]?.slot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);

    const res = await demoSignIn(selectedSlot);
    setLoading(false);

    if (res.success) {
      router.push("/app/home");
    } else {
      setError(res.error || "Failed to start the demo session. Please try again.");
    }
  };

  const handleContinueAsGuest = async () => {
    await continueAsGuest();
    router.push("/app/home");
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-2">
          <Badge variant="warning" icon={<FlaskConical className="h-3 w-3" />}>
            Staging Preview
          </Badge>
        </div>
        <CardTitle>Welcome to {BRAND.name}</CardTitle>
        <CardDescription>Demo environment — no account or email required.</CardDescription>
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

        {demoAuth.options.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pick a demo profile</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {demoAuth.options.map((option) => (
                <button
                  key={option.slot}
                  type="button"
                  onClick={() => setSelectedSlot(option.slot)}
                  aria-pressed={selectedSlot === option.slot}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    selectedSlot === option.slot
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Each profile keeps its own workspace. Profiles are shared: anyone who picks the same
              one shares its progress.
            </p>
          </div>
        )}

        <Button type="button" className="w-full" loading={loading} onClick={handleContinue}>
          Continue to {BRAND.name}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleContinueAsGuest}>
          Continue as Guest
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Guest mode stores all syllabus, planner, and test data locally on your device. It migrates
          automatically when you continue.
        </p>
      </CardContent>
      <CardFooter className="justify-center border-t border-border pt-4 text-xs text-muted-foreground">
        Staging preview for evaluation only — data may be reset at any time.
      </CardFooter>
    </Card>
  );
}
