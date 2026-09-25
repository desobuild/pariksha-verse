"use client";

import { RevisionWorkspace } from "@/components/revision/revision-workspace";

/**
 * Revision Queue (Phase 8): due today / overdue / upcoming spaced reviews
 * with a simple deterministic schedule (1 → 3 → 7 → 14 → 30 days).
 */
export default function RevisionPage() {
  return <RevisionWorkspace />;
}
