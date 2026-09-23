import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";
import { LandingCTA } from "@/components/shared/landing-cta";
import { Button } from "@/components/ui/button";
import { BookOpen, LineChart, CalendarCheck } from "lucide-react";

export default function RootPage() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="space-y-10">
          {/* Brand lockup */}
          <div className="flex items-center gap-3">
            <BrandMark size={56} />
            <span className="text-xl font-bold tracking-tight text-foreground">
              {BRAND.logo.text}
            </span>
          </div>

          {/* Hero */}
          <div className="space-y-3">
            <h1 className="type-display text-left">
              Your complete exam prep companion
            </h1>
            <p className="type-body-large text-left text-muted-foreground">
              Track your syllabus, plan your days, practice with purpose, and revise on
              schedule — all in one calm place.
            </p>
          </div>

          {/* Decorative capability strip (purely visual, no claims) */}
          <div className="flex items-center gap-6" aria-hidden="true">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-tint text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground-subtle">Syllabus</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-tint text-primary">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground-subtle">Planner</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-tint text-primary">
                <LineChart className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground-subtle">Progress</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <LandingCTA />
            <Button asChild variant="secondary" size="lg" className="w-full font-semibold">
              <Link href="/auth/sign-in">I already have an account</Link>
            </Button>
          </div>

          <p className="text-xs text-foreground-subtle text-left">
            No mandatory signup. Start preparing immediately on your device — your data
            stays yours.
          </p>
        </div>
      </div>

      <footer className="px-6 pb-6">
        <div className="mx-auto max-w-md text-center text-[11px] text-foreground-subtle">
          By continuing you agree to our{" "}
          <Link href={BRAND.links.terms} className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href={BRAND.links.privacy} className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </div>
      </footer>
    </main>
  );
}
