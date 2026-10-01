import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { APP_COMMIT_SHA, APP_VERSION } from "./version";

/**
 * Phase 14G — structured server-side logging for ParikshaVerse.
 *
 * One JSON line per event, written through `console.info/warn/error` so it is
 * captured by Cloudflare Workers Logs in the deployed Worker (wrangler.jsonc
 * has `observability.enabled = true`) and stays readable in local dev and
 * tests. Every entry carries the same core fields; callers add only safe,
 * flat, primitive fields via the `fields` argument.
 *
 * PRIVACY / SECURITY CONTRACT (docs/observability.md is normative):
 *
 * Callers log EVENTS, never objects. The `fields` allow-surface is flat
 * primitives only, and every key is checked against a redaction pattern that
 * catches credentials, tokens, session material, cookies, emails, and hashes
 * — a matching key is emitted as "[redacted]" with its value discarded, so a
 * caller that mistakenly passes sensitive data cannot leak it. This is a
 * backstop, not permission to log sensitive values: never pass request bodies,
 * headers, URLs with query parameters, database rows, or user objects here.
 *
 * Never log: magic-link tokens, verification-token hashes, session cookies or
 * IDs, SESSION_SECRET, API keys, passwords, raw Authorization headers, request
 * bodies, full URLs with query parameters, email addresses, question/answer
 * content, or full database records.
 *
 * Server-only: in a browser runtime every call is a no-op — this module must
 * never be pulled into client components.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  /** Flat, primitive, non-sensitive fields only (see module contract). */
  readonly [key: string]: string | number | boolean | null | undefined;
}

const SERVICE_NAME = "pariksha-verse";

/**
 * Keys whose values must never reach a log line, by name. Matched
 * case-insensitively against the whole key. Deliberately broad: a near-miss
 * that gets redacted costs a debugging round-trip, a near-miss that leaks
 * costs a security incident.
 */
const REDACTED_KEY_PATTERN =
  /(token|secret|password|passwd|authorization|auth_key|cookie|session|email|hash|credential|api[-_]?key|access[-_]?key|private[-_]?key)/i;

const REDACTED_PLACEHOLDER = "[redacted]";

/** Caps accidental long values (URLs, messages) at a log-friendly size. */
const MAX_STRING_LENGTH = 256;
const MAX_FIELDS = 24;

const EVENT_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

/** True in a real browser runtime (not vitest/jsdom, not server-side render). */
function isClientRuntime(): boolean {
  return typeof window !== "undefined" && !process.env.VITEST && process.env.NODE_ENV !== "test";
}

/**
 * Resolves the deployment environment for log entries, mirroring the trusted
 * server-side resolution used across the auth layer (Cloudflare bindings in
 * workerd, process.env in Node dev/tests). Never reads client input.
 */
export function resolveEnvironment(): string {
  if (isClientRuntime()) return "client";
  try {
    const cfEnv = getCloudflareEnv();
    return (
      cfEnv.ENVIRONMENT ||
      process.env.ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development"
    ).toLowerCase();
  } catch {
    return (process.env.ENVIRONMENT || process.env.NODE_ENV || "development").toLowerCase();
  }
}

/**
 * Applies the redaction/normalization contract to one fields object.
 * Exported for tests; logEvent sanitizes internally, so callers never need
 * to pre-sanitize.
 */
export function sanitizeFields(
  fields: LogFields | undefined
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!fields) return out;

  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    if (count >= MAX_FIELDS) break;
    if (rawValue === undefined) continue;

    const key = rawKey.slice(0, 64);
    if (REDACTED_KEY_PATTERN.test(key)) {
      out[key] = REDACTED_PLACEHOLDER;
      count += 1;
      continue;
    }

    if (rawValue === null) {
      out[key] = null;
    } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      out[key] = rawValue;
    } else if (typeof rawValue === "string") {
      out[key] =
        rawValue.length > MAX_STRING_LENGTH
          ? `${rawValue.slice(0, MAX_STRING_LENGTH)}…[truncated]`
          : rawValue;
    } else {
      // Non-primitive values are never serialized — events only.
      out[key] = "[non-primitive]";
    }
    count += 1;
  }
  return out;
}

/**
 * Emits one structured log line. Never throws, and does nothing in a browser
 * runtime: logging must not be able to break request handling or leak server
 * event names into client bundles.
 */
export function logEvent(level: LogLevel, event: string, fields?: LogFields): void {
  if (isClientRuntime()) return;
  try {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      environment: resolveEnvironment(),
      event: event.replace(EVENT_NAME_PATTERN, "_"),
      version: APP_VERSION,
      deployment: APP_COMMIT_SHA,
      ...sanitizeFields(fields),
    };
    const line = JSON.stringify(entry);
    if (level === "warn") {
      console.warn(line);
    } else if (level === "error") {
      console.error(line);
    } else {
      console.info(line);
    }
  } catch {
    // A logging failure must never break request handling.
  }
}

export const logger = {
  info: (event: string, fields?: LogFields) => logEvent("info", event, fields),
  warn: (event: string, fields?: LogFields) => logEvent("warn", event, fields),
  error: (event: string, fields?: LogFields) => logEvent("error", event, fields),
};
