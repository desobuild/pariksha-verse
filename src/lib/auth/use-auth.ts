"use client";

import { useAuthContext } from "./auth-context";

/**
 * Hook to access current authentication state and actions:
 * - identity: GuestIdentity | AuthenticatedIdentity
 * - status: "loading" | "guest" | "authenticated"
 * - signIn, createAccount, verify, continueAsGuest, signOut
 */
export function useAuth() {
  return useAuthContext();
}
