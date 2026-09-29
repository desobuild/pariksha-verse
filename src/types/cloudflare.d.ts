/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers Runtime Environment Bindings
 */
export interface CloudflareEnv {
  /**
   * Primary SQLite/D1 database binding
   */
  DB: D1Database;

  /**
   * Environment flag (development, preview, production, staging)
   */
  ENVIRONMENT?: string;

  /**
   * Cryptographic secret for signing session and auth tokens (HMAC-SHA256)
   */
  SESSION_SECRET?: string;

  /**
   * Resend API key for transactional emails
   */
  RESEND_API_KEY?: string;

  /**
   * Outgoing transactional email sender address
   */
  EMAIL_FROM?: string;

  /**
   * Public base URL for client routing and magic-link verification URLs
   */
  NEXT_PUBLIC_APP_URL?: string;

  /**
   * Isolated test-only auth mock token shortcut flag (default false)
   */
  ENABLE_TEST_AUTH_MOCK?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __CLOUDFLARE_ENV__: CloudflareEnv | undefined;
}
