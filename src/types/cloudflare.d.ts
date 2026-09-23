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
   * Environment flag (development, preview, production)
   */
  ENVIRONMENT?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __CLOUDFLARE_ENV__: CloudflareEnv | undefined;
}
