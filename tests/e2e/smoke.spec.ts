import { test, expect } from "@playwright/test";
import { BRAND } from "../../src/config/brand";

test.describe("ParikshaVerse Smoke Tests", () => {
  test("landing page renders brand name and navigation options", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(new RegExp(BRAND.name));
    await expect(page.getByRole("heading", { name: BRAND.name })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open app shell/i })).toBeVisible();
  });

  test("exam selection route renders available competitive exams", async ({ page }) => {
    await page.goto("/exam/select");
    await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();
    await expect(page.getByText("NEET")).toBeVisible();
  });

  test("app shell renders home dashboard with navigation elements", async ({ page }) => {
    await page.goto("/app/home");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });
});
