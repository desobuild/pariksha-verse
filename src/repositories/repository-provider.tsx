"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { DomainRepositories } from "./interfaces";
import { createGuestRepositories } from "./guest-repositories";
import { createAuthenticatedRepositories } from "./authenticated-repositories";
import { useAuth } from "@/lib/auth/use-auth";
import { appStorage } from "@/lib/storage";

const RepositoryContext = createContext<DomainRepositories | null>(null);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const { identity } = useAuth();

  const repositories = useMemo<DomainRepositories>(() => {
    if (identity?.type === "authenticated") {
      return createAuthenticatedRepositories();
    }
    const guestId = identity?.guest?.id || "guest_default";
    return createGuestRepositories(appStorage, guestId);
  }, [identity]);

  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * Access the domain repositories.
 * Transparently resolves to Guest (IndexedDB) or Authenticated (API) persistence
 * without requiring `if (isGuest)` checks in UI components.
 */
export function useRepositories(): DomainRepositories {
  const context = useContext(RepositoryContext);
  if (!context) {
    // Return a default guest repository if accessed outside of provider (e.g. tests)
    return createGuestRepositories(appStorage);
  }
  return context;
}
