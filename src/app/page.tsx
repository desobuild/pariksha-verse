import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function RootPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-subtle">
          {BRAND.logo.mark}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {BRAND.name}
        </h1>
        <p className="text-base text-muted-foreground">{BRAND.tagline}</p>
        <div className="pt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/exam/select"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Get Started
          </Link>
          <Link
            href="/app/home"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open App Shell
          </Link>
        </div>
      </div>
    </main>
  );
}
