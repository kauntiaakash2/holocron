import { test, expect } from "@playwright/test";
test("responsive landing and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".preloader")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "output/playwright/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/mobile.png",
    fullPage: true,
  });
});

test("intro completes on reload without a skip button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 10000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip introduction" })).toHaveCount(0);
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
});

test("landing and registration satisfy automated WCAG checks", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/register", "/privacy", "/terms", "/admin"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
