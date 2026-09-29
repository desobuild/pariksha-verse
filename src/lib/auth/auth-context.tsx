"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type {
  AuthIdentity,
  AuthStatus,
  AuthenticatedUser,
  DemoAuthConfig,
  GuestIdentity,
} from "./auth-types";
import { getOrCreateGuestIdentity, clearGuestIdentity } from "./guest-identity";
import { migrateGuestData } from "./guest-migration";
import { appStorage } from "@/lib/storage";

interface AuthContextValue {
  identity: AuthIdentity | null;
  status: AuthStatus;
  user: AuthenticatedUser | null;
  guest: GuestIdentity | null;
  isMigrating: boolean;
  demoAuth: DemoAuthConfig;
  signIn: (email: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  createAccount: (email: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  verify: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  demoSignIn: (slot?: string) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => Promise<GuestIdentity>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isMigrating, setIsMigrating] = useState(false);
  // Server-decided staging demo availability. Disabled until the server says
  // otherwise; a client can never flip this on.
  const [demoAuth, setDemoAuth] = useState<DemoAuthConfig>({
    enabled: false,
    options: [],
  });

  // Initialize session or guest identity
  const checkAuth = useCallback(async () => {
    try {
      // 1. Check server session
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as {
          user?: AuthenticatedUser;
          demoAuth?: DemoAuthConfig;
        };
        if (
          data.demoAuth &&
          typeof data.demoAuth.enabled === "boolean" &&
          Array.isArray(data.demoAuth.options)
        ) {
          setDemoAuth({
            enabled: data.demoAuth.enabled,
            options: data.demoAuth.options,
          });
        }
        if (data.user) {
      const authUser: AuthenticatedUser = data.user;
      setIdentity({
        type: "authenticated",
        id: authUser.id,
        user: authUser,
      });
      setStatus("authenticated");

      // Run background migration if guest data exists. Page-load retries are
      // the safety net: an interrupted attempt stays retryable because guest
      // data is only cleared after the server confirms success.
      setIsMigrating(true);
      migrateGuestData(authUser.id, appStorage).finally(() => setIsMigrating(false));
      return;
        }
      }

      // 2. Not authenticated: establish guest identity
      const guestId = await getOrCreateGuestIdentity(appStorage);
      setIdentity({
        type: "guest",
        id: guestId.id,
        guest: guestId,
      });
      setStatus("guest");
    } catch {
      // Graceful fallback to guest
      const guestId = await getOrCreateGuestIdentity(appStorage);
      setIdentity({
        type: "guest",
        id: guestId.id,
        guest: guestId,
      });
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const continueAsGuest = useCallback(async (): Promise<GuestIdentity> => {
    const guestId = await getOrCreateGuestIdentity(appStorage);
    setIdentity({
      type: "guest",
      id: guestId.id,
      guest: guestId,
    });
    setStatus("guest");
    return guestId;
  }, []);

  const signIn = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error || "Sign in failed" };
      }
      return { success: true, token: data.token };
    } catch {
      return { success: false, error: "Network error occurred" };
    }
  }, []);

  const createAccount = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/auth/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error || "Account creation failed" };
      }
      return { success: true, token: data.token };
    } catch {
      return { success: false, error: "Network error occurred" };
    }
  }, []);

  const verify = useCallback(async (email: string, token: string) => {
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
        credentials: "include",
      });
      const data = (await res.json()) as { user: AuthenticatedUser; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error || "Verification failed" };
      }

      const authUser: AuthenticatedUser = data.user;
      setIdentity({
        type: "authenticated",
        id: authUser.id,
        user: authUser,
      });
      setStatus("authenticated");

      // Migrate guest data BEFORE reporting success so the caller does not
      // navigate away while the migration request is still in flight — a
      // full-page navigation would otherwise abort it. migrateGuestData
      // resolves on failure too (it records retryable state instead of
      // throwing), so sign-in never breaks when migration cannot complete.
      setIsMigrating(true);
      try {
        await migrateGuestData(authUser.id, appStorage);
      } finally {
        setIsMigrating(false);
      }

      return { success: true };
    } catch {
      return { success: false, error: "Verification request failed" };
    }
  }, []);

  const demoSignIn = useCallback(async (slot?: string) => {
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: AuthenticatedUser;
        error?: string;
      };
      if (!res.ok) {
        return { success: false, error: data.error || "Demo sign in failed" };
      }
      if (!data.user) {
        return { success: false, error: "Demo sign in failed" };
      }

      const authUser: AuthenticatedUser = data.user;
      setIdentity({
        type: "authenticated",
        id: authUser.id,
        user: authUser,
      });
      setStatus("authenticated");

      // Same automatic guest-to-account migration used by email verification.
      // Awaited (migrateGuestData never throws) so the caller only redirects
      // once the migration request has actually completed — navigating earlier
      // could abort the in-flight POST and leave guest data un-migrated.
      setIsMigrating(true);
      try {
        await migrateGuestData(authUser.id, appStorage);
      } finally {
        setIsMigrating(false);
      }

      return { success: true };
    } catch {
      return { success: false, error: "Demo sign in request failed" };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore
    }

    // Reset to local guest session
    await clearGuestIdentity(appStorage);
    const guestId = await getOrCreateGuestIdentity(appStorage);
    setIdentity({
      type: "guest",
      id: guestId.id,
      guest: guestId,
    });
    setStatus("guest");
  }, []);

  const user = identity?.type === "authenticated" ? identity.user || null : null;
  const guest = identity?.type === "guest" ? identity.guest || null : null;

  return (
    <AuthContext.Provider
      value={{
        identity,
        status,
        user,
        guest,
        isMigrating,
        demoAuth,
        signIn,
        createAccount,
        verify,
        demoSignIn,
        continueAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultGuestContext: AuthContextValue = {
  identity: { type: "guest", id: "guest_default" },
  status: "guest",
  user: null,
  guest: { id: "guest_default", createdAt: 0 },
  isMigrating: false,
  demoAuth: { enabled: false, options: [] },
  signIn: async () => ({ success: false }),
  createAccount: async () => ({ success: false }),
  verify: async () => ({ success: false }),
  demoSignIn: async () => ({ success: false }),
  continueAsGuest: async () => ({ id: "guest_default", createdAt: 0 }),
  signOut: async () => {},
};

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultGuestContext;
  }
  return context;
}
