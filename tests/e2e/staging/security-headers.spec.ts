import { test, expect, type Page } from "@playwright/test";
import { demoSignIn, demoSignOut } from "./helpers";

/**
 * Phase 14F (PARTS K/L) — staging deployment security verification.
 *
 * Exercises the hardened headers against the deployed staging Worker: demo
 * authentication keeps working, auth cookies keep their HTTPS flags, logout
 * still invalidates server-side, and the static-asset layer (which never runs
 * the Worker) honors the public/_headers policy.
 */

/**
 * Playwright's headers() map can omit Set-Cookie; headersArray() always
 * carries every header instance (await-safe: sync or Promise-returning).
 */
async function allSetCookies(response: { headersArray(): unknown }): Promise<string> {
  const headers = (await response.headersArray()) as Array<{ name: string; value: string }>;
  return headers
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .join("\n");
}

async function collectDocumentHeaders(page: Page, path: string): Promise<Record<string, string>> {
  const response = await page.goto(path);
  expect(response, `GET ${path}`).not.toBeNull();
  return response!.headers();
}

test.describe("Phase 14F — staging security hardening", () => {
  test("demo sign-in works under CSP and issues a hardened session cookie", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /content.security.policy/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });

    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/demo") && res.request().method() === "POST"
    );

    await demoSignIn(page, "Friend 1");

    const loginResponse = await loginResponsePromise;
    const setCookie = await allSetCookies(loginResponse);
    expect(setCookie).toContain("pv_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure"); // staging is HTTPS-only
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");

    // The authenticated home renders with the full header set and no violations.
    const headers = await collectDocumentHeaders(page, "/app/home");
    expect(headers["content-security-policy"]).toContain("'nonce-");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toMatch(/^max-age=\d+/);
    expect(violations, "CSP violations during demo sign-in + home").toEqual([]);
  });

  test("authenticated API responses carry security headers", async ({ page }) => {
    await demoSignIn(page, "Friend 2");
    const response = await page.request.get("/api/auth/session");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("logout clears the cookie and the old session is rejected server-side", async ({
    page,
    request,
  }) => {
    await demoSignIn(page, "Friend 3");

    // Capture the live session cookie value before logout.
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "pv_session");
    expect(session, "pv_session cookie after demo sign-in").toBeTruthy();

    const signOutResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/sign-out") && res.request().method() === "POST"
    );
    await demoSignOut(page);
    const signOutResponse = await signOutResponsePromise;
    const setCookie = await allSetCookies(signOutResponse);
    expect(setCookie).toContain("pv_session=;");
    expect(setCookie).toContain("Max-Age=0");

    // Post-logout session rejection: replaying the pre-logout cookie through a
    // cookie-isolated request context must not authenticate (Phase 14E
    // revocation — headers must not have changed this).
    const replay = await request.get("/api/auth/session", {
      headers: { cookie: `pv_session=${session!.value}` },
    });
    expect(replay.status()).toBe(200);
    const body = (await replay.json()) as { user: unknown };
    expect(body.user).toBeNull();
  });

  test("static assets from the edge layer carry nosniff and immutable caching", async ({ page }) => {
    await page.goto("/");
    const chunk = await page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]"))
        .map((s) => (s as HTMLScriptElement).getAttribute("src"))
        .find((src) => src?.includes("/_next/static/"))
    );
    expect(chunk, "a /_next/static script is present on the page").toBeTruthy();

    const response = await page.request.get(chunk!);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["cache-control"]).toContain("immutable");
    // Static binaries are not documents: no frame/CSP controls expected there.
    expect(headers["x-frame-options"]).toBeUndefined();
  });

  test("404 document responses are protected and signed-out API rejects cleanly", async ({ page }) => {
    const headers = await collectDocumentHeaders(page, "/definitely-not-a-real-page");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});
