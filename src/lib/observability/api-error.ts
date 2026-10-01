import { NextResponse } from "next/server";
import { logger, type LogFields } from "./logger";
import { getRequestId } from "./request-id";

/**
 * Phase 14G — centralized server error normalization for API routes.
 *
 * The one place where a caught server-side failure becomes (a) a structured
 * server log with the request id and safe error metadata, and (b) a generic
 * client-facing JSON response. Phase 14F established that internal errors
 * must never reach clients; this module keeps that guarantee while adding the
 * observability the bare `catch {` blocks previously swallowed.
 *
 * Contract:
 * - The public `message` is a static string chosen by the route — never
 *   derived from the caught error.
 * - Logs carry `error_name`, a truncated `error_message` (SQLite/D1 errors
 *   name constraints and tables, never bindings), and a truncated stack.
 *   Logs are server-side (Workers Logs); none of this reaches the response.
 * - The request id rides along from the middleware-forwarded header, so a
 *   client-reported `X-Request-ID` maps straight to the error's log lines.
 * - Callers that already return a more specific response (e.g. the mock-test
 *   422 domain-error path) keep doing so; this helper is only for the
 *   "internal failure" branch.
 */

/** Caps error metadata so a pathological message cannot flood log lines. */
const MAX_ERROR_MESSAGE_LENGTH = 256;
const MAX_ERROR_STACK_LENGTH = 1024;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

export interface ApiErrorInput {
  /** Structured event name, e.g. "auth.sign_in.failure" or "api.error". */
  event: string;
  /** The caught value (unknown — handlers catch bare). */
  error: unknown;
  /** Public, static, actionable message returned to the client. */
  message: string;
  /** The incoming request, when available, for request-id propagation. */
  request?: Request;
  /** Response status; 500 unless a route deliberately narrows it. */
  status?: number;
  /** Log level for the event. Client-triggered failures may warrant "warn". */
  level?: "warn" | "error";
  /** Additional safe fields (rule names, scopes — never identifiers/tokens). */
  fields?: LogFields;
}

function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { name: "UnknownError", message: error };
  }
  return { name: "UnknownError", message: "" };
}

/**
 * Logs the failure and returns the generic client response. Never throws.
 */
export function apiErrorResponse(input: ApiErrorInput): Response {
  const { name, message, stack } = describeError(input.error);
  const fields: LogFields = {
    error_name: name,
    ...(message ? { error_message: truncate(message, MAX_ERROR_MESSAGE_LENGTH) } : {}),
    // Server-side diagnosis detail: truncated stacks stay in logs (Workers
    // Logs) and never reach the response body.
    ...(stack && input.level !== "warn"
      ? { error_stack: truncate(stack, MAX_ERROR_STACK_LENGTH) }
      : {}),
    ...input.fields,
    ...(input.request ? { request_id: getRequestId(input.request) } : {}),
  };

  logger[input.level ?? "error"](input.event, fields);

  return NextResponse.json({ error: input.message }, { status: input.status ?? 500 });
}

/**
 * Convenience for logging an Error with its stack at error level. Kept
 * separate from apiErrorResponse for code paths that already build their own
 * response but still need the failure logged.
 */
export function logErrorWithStack(event: string, error: unknown, fields?: LogFields): void {
  const { name, message, stack } = describeError(error);
  logger.error(event, {
    error_name: name,
    ...(message ? { error_message: truncate(message, MAX_ERROR_MESSAGE_LENGTH) } : {}),
    ...(stack ? { error_stack: truncate(stack, MAX_ERROR_STACK_LENGTH) } : {}),
    ...fields,
  });
}
