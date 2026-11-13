import { expect, test } from "@playwright/test";

for (const width of [375, 1440]) {
  test(`challenge explorer supports selection and keyboard navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#domains");
    const section = page.locator("#domains");
    const tabs = section.getByRole("tab");
    const panel = section.getByRole("tabpanel");
    await expect(tabs).toHaveCount(6);
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAccessibleName("Training infrastructure");

    await tabs.filter({ hasText: "Testing systems" }).click();
    await expect(panel).toHaveAccessibleName("Testing systems");
    await expect(panel).toContainText("Edge-case exploration tools");
    await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("End");
    await expect(tabs.last()).toBeFocused();
    await expect(panel).toHaveAccessibleName("Quality assurance");
    await page.keyboard.press("ArrowDown");
    await expect(tabs.first()).toBeFocused();
    await expect(panel).toHaveAccessibleName("Training infrastructure");
    await page.keyboard.press("ArrowUp");
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(panel).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
