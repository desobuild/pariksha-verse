"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

/**
 * Primary landing action. Returning users (an active workspace exists)
 * continue straight into their preparation space; new users enter setup.
 */
export function LandingCTA() {
  const { workspace, status } = useActiveWorkspace();
  const hasWorkspace = status === "ready" && workspace !== null;

  return (
    <Button asChild size="lg" className="w-full font-semibold">
      <Link href={hasWorkspace ? "/app/home" : "/exam/select"}>
        {hasWorkspace ? "Continue Preparation" : "Get Started"}
      </Link>
    </Button>
  );
}
