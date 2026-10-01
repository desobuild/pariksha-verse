import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { users } from "@/db/schema";
import { getSessionSecret, KNOWN_INSECURE_DEV_SECRET } from "@/lib/auth/crypto-session";
import {
  createSessionCookie,
  createClearSessionCookie,
  shouldUseSecureCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import {
  getEmailProvider,
  ResendEmailProvider,
  ConsoleEmailProvider,
  TestEmailProvider,
  setEmailProvider,
} from "@/lib/email/email-service";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { POST as createAccountHandler } from "@/app/api/auth/create-account/route";
import { POST as migrateHandler } from "@/app/api/auth/migrate/route";

describe("Phase 13A.2 — Cloudflare Staging Deployment Readiness", () => {
  let db: DatabaseInstance;
  let currentD1: D1Database;
  let testEmailProvider: TestEmailProvider;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  beforeEach(() => {
    currentD1 = createTestD1Database();
    globalThis.__CLOUDFLARE_ENV__ = { DB: currentD1 };
    db = drizzle(currentD1, { schema });

    testEmailProvider = new TestEmailProvider();
    setEmailProvider(testEmailProvider);
    process.env.SESSION_SECRET = "test_vitest_mock_session_secret_32b_min_length";
    delete process.env.ENABLE_TEST_AUTH_MOCK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
    setEmailProvider(null);
  });

  describe("1. Cloudflare Configuration Integrity (wrangler.jsonc)", () => {
    it("has distinct D1 databases and environments for local, staging, and production", () => {
      const wranglerPath = path.resolve(process.cwd(), "wrangler.jsonc");
      expect(fs.existsSync(wranglerPath)).toBe(true);

      const content = fs.readFileSync(wranglerPath, "utf-8");
      // Remove comments and trailing commas to parse JSON
      const sanitized = content
        .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1");
      const config = JSON.parse(sanitized);

      // Local / default
      expect(config.name).toBe("pariksha-verse");
      expect(config.d1_databases[0].database_name).toBe("pariksha-verse-db-local");
      expect(config.d1_databases[0].binding).toBe("DB");
      expect(config.d1_databases[0].migrations_dir).toBe("src/db/migrations");

      // Staging
      expect(config.env).toBeDefined();
      expect(config.env.staging).toBeDefined();
      expect(config.env.staging.name).toBe("pariksha-verse-staging");
      expect(config.env.staging.d1_databases[0].binding).toBe("DB");
      expect(config.env.staging.d1_databases[0].database_name).toBe("pariksha-verse-db-staging");
      expect(config.env.staging.d1_databases[0].database_id).toBe(
        "bbe9b6c9-1c52-4b67-b513-c51b2b99a505"
      );
      expect(config.env.staging.vars.ENVIRONMENT).toBe("staging");
      expect(config.env.staging.vars.ENABLE_TEST_AUTH_MOCK).toBe("false");
      // Phase 14I: staging is the PUBLIC deployment and is served from its
      // workers.dev subdomain — no custom domain exists or is planned.
      expect(config.env.staging.vars.NEXT_PUBLIC_APP_URL).toBe(
        "https://pariksha-verse-staging.desobuild.workers.dev"
      );

      // Production
      expect(config.env.production).toBeDefined();
      expect(config.env.production.name).toBe("pariksha-verse-production");
      expect(config.env.production.d1_databases[0].binding).toBe("DB");
      expect(config.env.production.d1_databases[0].database_name).toBe(
        "pariksha-verse-db-production"
      );
      expect(config.env.production.d1_databases[0].database_id).toBe(
        "34609461-2d5e-4bad-9088-71a9416c36f1"
      );
      expect(config.env.production.vars.ENVIRONMENT).toBe("production");
      expect(config.env.production.vars.ENABLE_TEST_AUTH_MOCK).toBe("false");
      expect(config.env.production.vars.NEXT_PUBLIC_APP_URL).toBe("https://parikshaverse.in");

      // Database isolation guarantee
      expect(config.d1_databases[0].database_name).not.toBe(
        config.env.staging.d1_databases[0].database_name
      );
      expect(config.env.staging.d1_databases[0].database_name).not.toBe(
        config.env.production.d1_databases[0].database_name
      );
      expect(config.env.staging.d1_databases[0].database_id).not.toBe(
        config.env.production.d1_databases[0].database_id
      );
    });

    it("regenerates build-info automatically before every deploy (Phase 14I)", () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      for (const script of ["cf:deploy:staging", "cf:deploy:prod"]) {
        const command = pkg.scripts[script];
        expect(command, `${script} must be defined`).toBeDefined();
        // Phase 14H carried forward: deploying without running the build-info
        // generator first let the baked deployment SHA go stale. The generator
        // must be part of the script itself — no manually required pre-step.
        expect(
          command.startsWith("node scripts/generate-build-info.mjs && "),
          `${script} must regenerate build-info before deploying`
        ).toBe(true);
        expect(command).toContain("vinext-cloudflare deploy");
      }
    });

    it("does not contain sensitive secrets committed in wrangler.jsonc", () => {
      const wranglerPath = path.resolve(process.cwd(), "wrangler.jsonc");
      const content = fs.readFileSync(wranglerPath, "utf-8");

      expect(content).not.toContain("re_");
      expect(content).not.toContain("SESSION_SECRET");
      expect(content).not.toContain("RESEND_API_KEY");
    });

    it("has valid vite.config.ts configured for vinext Cloudflare Workers edge bundling", () => {
      const viteConfigPath = path.resolve(process.cwd(), "vite.config.ts");
      expect(fs.existsSync(viteConfigPath)).toBe(true);

      const content = fs.readFileSync(viteConfigPath, "utf-8");
      expect(content).toContain("@cloudflare/vite-plugin");
      expect(content).toContain("vinext");
      expect(content).toContain('name: "rsc"');
      expect(content).toContain('childEnvironments: ["ssr"]');
    });

    it("has required edge runtime and bundling dependencies declared in package.json", () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      expect(pkg.packageManager).toBe("pnpm@11.28.0");
      expect(pkg.dependencies["react-server-dom-webpack"]).toBeDefined();
      expect(pkg.devDependencies["@cloudflare/vite-plugin"]).toBeDefined();
      expect(pkg.devDependencies["@vitejs/plugin-rsc"]).toBeDefined();
      expect(pkg.devDependencies["wrangler"]).toBeDefined();
    });
  });

  describe("2. Staging & Production Security Guards", () => {
    it("rejects missing SESSION_SECRET in staging", () => {
      delete process.env.SESSION_SECRET;
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
      };

      expect(() => getSessionSecret()).toThrowError(/SESSION_SECRET is missing/);
    });

    it("rejects missing SESSION_SECRET in production", () => {
      delete process.env.SESSION_SECRET;
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "production",
      };

      expect(() => getSessionSecret()).toThrowError(/SESSION_SECRET is missing/);
    });

    it("rejects known insecure development secret in staging and production", () => {
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
        SESSION_SECRET: KNOWN_INSECURE_DEV_SECRET,
      };

      expect(() => getSessionSecret()).toThrowError(/cannot be the default development secret/);

      globalThis.__CLOUDFLARE_ENV__.ENVIRONMENT = "production";
      expect(() => getSessionSecret()).toThrowError(/cannot be the default development secret/);
    });

    it("rejects session secret with insufficient length (< 32 chars) in staging/production", () => {
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
        SESSION_SECRET: "short_secret_under_32_chars",
      };

      expect(() => getSessionSecret()).toThrowError(/at least 32 characters/);
    });

    it("accepts valid 32+ character SESSION_SECRET in staging/production", () => {
      const validSecret = "a_very_secure_random_staging_session_secret_32bytes";
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
        SESSION_SECRET: validSecret,
      };

      expect(getSessionSecret()).toBe(validSecret);
    });

    it("strictly disallows ENABLE_TEST_AUTH_MOCK in staging even if set to true", async () => {
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: currentD1,
        ENVIRONMENT: "staging",
        ENABLE_TEST_AUTH_MOCK: "true",
        NEXT_PUBLIC_APP_URL: "https://staging.parikshaverse.in",
      };
      process.env.ENABLE_TEST_AUTH_MOCK = "true";

      const email = "staging_mock_forbidden@example.com";
      await db.insert(users).values({
        id: "usr_mock_check",
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("https://staging.parikshaverse.in/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await signInHandler(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;

      expect(data._testToken).toBeUndefined();
      expect(data.token).toBeUndefined();
    });

    it("strictly disallows ENABLE_TEST_AUTH_MOCK in production even if set to true", async () => {
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: currentD1,
        ENVIRONMENT: "production",
        ENABLE_TEST_AUTH_MOCK: "true",
        NEXT_PUBLIC_APP_URL: "https://parikshaverse.in",
      };
      process.env.ENABLE_TEST_AUTH_MOCK = "true";

      const req = new Request("https://parikshaverse.in/api/auth/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "prod_mock_forbidden@example.com" }),
      });

      const res = await createAccountHandler(req);
      expect(res.status).toBe(201);
      const data = (await res.json()) as Record<string, unknown>;

      expect(data._testToken).toBeUndefined();
      expect(data.token).toBeUndefined();
    });
  });

  describe("3. Staging & Production Email Provider Safety", () => {
    it("fails safely in staging if RESEND_API_KEY is missing (no fallback to console/test provider)", async () => {
      setEmailProvider(null); // Reset mock provider
      delete process.env.RESEND_API_KEY;

      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
      };

      const provider = getEmailProvider();
      expect(provider).not.toBeInstanceOf(ConsoleEmailProvider);
      expect(provider).not.toBeInstanceOf(TestEmailProvider);

      const result = await provider.sendMagicLinkEmail({
        email: "test@example.com",
        verificationUrl: "https://staging.parikshaverse.in/auth/verify?token=123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Transactional email provider is not configured for staging/production"
      );
    });

    it("initializes ResendEmailProvider when RESEND_API_KEY is configured in staging", () => {
      setEmailProvider(null);
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: createTestD1Database(),
        ENVIRONMENT: "staging",
        RESEND_API_KEY: "re_mock_test_key_staging",
        EMAIL_FROM: "ParikshaVerse Staging <auth@staging.parikshaverse.in>",
      };

      const provider = getEmailProvider();
      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  describe("4. Staging Verification URL Handling", () => {
    it("uses NEXT_PUBLIC_APP_URL from Cloudflare env when constructing verification URL", async () => {
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: currentD1,
        ENVIRONMENT: "staging",
        NEXT_PUBLIC_APP_URL: "https://staging.parikshaverse.in",
      };

      const email = "student_staging_url@example.com";
      await db.insert(users).values({
        id: "usr_staging_url",
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("https://staging.parikshaverse.in/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await signInHandler(req);
      expect(res.status).toBe(200);

      expect(testEmailProvider.sentEmails.length).toBe(1);
      const sent = testEmailProvider.sentEmails[0];
      expect(sent.verificationUrl).toMatch(
        /^https:\/\/staging\.parikshaverse\.in\/auth\/verify\?token=/
      );
      expect(sent.verificationUrl).toContain(`email=${encodeURIComponent(email)}`);
    });
  });

  describe("5. Secure-Cookie Enforcement on HTTPS / Staging", () => {
    it("flags cookie as Secure for HTTPS staging requests", () => {
      const secure = shouldUseSecureCookie(
        new Request("https://staging.parikshaverse.in/api/auth/verify")
      );
      expect(secure).toBe(true);

      const cookie = createSessionCookie(
        "mock_session_token",
        new Request("https://staging.parikshaverse.in/api/auth/verify")
      );
      expect(cookie).toContain("; Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=mock_session_token`);
    });

    it("flags clear cookie as Secure for HTTPS staging requests", () => {
      const cookie = createClearSessionCookie(
        new Request("https://staging.parikshaverse.in/api/auth/sign-out")
      );
      expect(cookie).toContain("; Secure");
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    });

    it("allows non-Secure cookie for local HTTP development", () => {
      const secure = shouldUseSecureCookie(new Request("http://localhost:3000/api/auth/verify"));
      expect(secure).toBe(false);

      const cookie = createSessionCookie(
        "dev_token",
        new Request("http://localhost:3000/api/auth/verify")
      );
      expect(cookie).not.toContain("; Secure");
    });
  });

  describe("6. Guest Migration Protection", () => {
    it("rejects unauthenticated guest migration requests with 401", async () => {
      const req = new Request("https://staging.parikshaverse.in/api/auth/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaces: [],
        }),
      });

      const res = await migrateHandler(req);
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Unauthorized");
    });
  });
});
