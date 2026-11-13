import { expect, test } from "@playwright/test";

test("scroll opens the actual archive from the artifact, reverses, and suspends the covered renderer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const portal = page.locator("[data-archive-portal]");
  await expect(portal).toHaveAttribute("data-enabled", "true", {
    timeout: 15000,
  });
  const mission = page.locator("#mission");
  const start = await mission.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const nextStart = await page
    .locator("#domains")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY);
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 0.45, behavior: "instant" }),
  );
  await expect(portal).toHaveAttribute("data-phase", "opening");
  expect(
    await mission.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeCloseTo(start, 0);
  expect(
    await page
      .locator("#domains")
      .evaluate((element) => element.getBoundingClientRect().top + scrollY),
  ).toBeCloseTo(nextStart, 0);
  expect(
    await portal
      .locator("svg")
      .last()
      .evaluate((element) => Number(getComputedStyle(element).opacity)),
  ).toBeGreaterThan(0);
  const travel = Number(await portal.getAttribute("data-portal-travel"));
  await page.evaluate(
    (top) => window.scrollTo({ top: top - 1, behavior: "instant" }),
    travel,
  );
  const beforeRelease = await mission.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  await page.evaluate(
    (top) => window.scrollTo({ top: top + 1, behavior: "instant" }),
    travel,
  );
  const afterRelease = await mission.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  expect(Math.abs(beforeRelease - afterRelease)).toBeLessThan(3);

  await expect(portal).toHaveAttribute("data-phase", "open");
  await expect(page.locator("[data-rendering]")).toHaveAttribute(
    "data-rendering",
    "suspended",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(portal).toHaveAttribute("data-phase", "idle");
  await expect(page.locator("[data-rendering]")).toHaveAttribute(
    "data-rendering",
    "visible",
  );
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 0.3, behavior: "instant" }),
  );
  await page
    .getByRole("navigation", { name: "Archive sections" })
    .getByRole("link", { name: "Mission brief" })
    .click();
  await expect(page.locator("#brief")).toBeFocused();
  await expect(page).toHaveURL(/#brief$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("reduced motion and keyboard access keep the archive fully available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator("[data-archive-portal]")).toHaveAttribute(
    "data-enabled",
    "false",
  );
  await page.locator('#brief a[href="/register"]').focus();
  await expect(page.locator('#brief a[href="/register"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/register$/);
});
