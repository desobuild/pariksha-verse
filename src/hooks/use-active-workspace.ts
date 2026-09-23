"use client";

import * as React from "react";
import { useRepositories } from "@/repositories/repository-provider";
import type { UserWorkspace } from "@/db/schema";

export type ActiveWorkspaceStatus = "loading" | "ready";

export interface ActiveWorkspaceState {
  workspace: UserWorkspace | null;
  status: ActiveWorkspaceStatus;
  refresh: () => Promise<void>;
}

/**
 * Resolves the current workspace without every page re-implementing
 * lookup logic. Works identically for guest (IndexedDB) and
 * authenticated (server-backed) persistence.
 */
export function useActiveWorkspace(): ActiveWorkspaceState {
  const repos = useRepositories();
  const [workspace, setWorkspace] = React.useState<UserWorkspace | null>(null);
  const [status, setStatus] = React.useState<ActiveWorkspaceStatus>("loading");

  const refresh = React.useCallback(async () => {
    try {
      const active = await repos.workspace.getActiveWorkspace();
      setWorkspace(active);
    } catch {
      setWorkspace(null);
    } finally {
      setStatus("ready");
    }
  }, [repos]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workspace, status, refresh };
}
