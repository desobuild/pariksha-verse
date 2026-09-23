import { test, expect } from "@playwright/test";
import { BRAND } from "../../src/config/brand";

test.describe("ParikshaVerse Smoke Tests", () => {
  test("landing page renders brand name and navigation options", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(new RegExp(BRAND.name));
    await expect(page.getByText(BRAND.logo.text).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /complete exam prep companion/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /already have an account/i })
    ).toBeVisible();
  });

  test("exam selection route renders available competitive exams", async ({ page }) => {
    await page.goto("/exam/select");
    await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();
    await expect(page.getByText("NEET").first()).toBeVisible();
    await expect(page.getByText("Available")).toBeVisible();
  });

  test("app shell renders for workspace-less visitors via setup routing", async ({ page }) => {
    // Fresh visitors are routed from preparation home into exam setup
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
    await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();
  });

  test("app more screen renders the shell with navigation", async ({ page }) => {
    await page.goto("/app/more");
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).first()).toBeVisible();
  });
});
