"use client";

import * as React from "react";
import { useRepositories } from "@/repositories/repository-provider";
import { useAuth } from "@/lib/auth/use-auth";
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
 *
 * While the session/guest identity is still resolving, the repository
 * provider serves guest repositories; resolving the workspace at that
 * moment would read the wrong (guest) store and wrongly signal "no
 * workspace" for authenticated users on full page loads. The hook
 * therefore stays in "loading" until the auth status is known.
 */
export function useActiveWorkspace(): ActiveWorkspaceState {
  const repos = useRepositories();
  const { status: authStatus } = useAuth();
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
    if (authStatus === "loading") {
      setStatus("loading");
      return;
    }
    void refresh();
  }, [authStatus, refresh]);

  return { workspace, status, refresh };
}
