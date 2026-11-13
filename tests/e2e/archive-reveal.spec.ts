import { expect, test } from "@playwright/test";

test("each content section reveals inside the viewport, including navigation jumps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    document.addEventListener("animationstart", (event) => {
      const item = event.target;
      if (
        !(item instanceof HTMLElement) ||
        !item.hasAttribute("data-archive-reveal")
      )
        return;
      const box = item.getBoundingClientRect();
      item.dataset.revealEntered =
        box.top < innerHeight && box.bottom > 0 ? "visible" : "offscreen";
    });
  });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  // The mission now gets one portal reveal, not a second text entrance.
  // Later sections retain their individual animations after the frame releases.
  await expect(page.locator("[data-archive-portal]")).toHaveAttribute(
    "data-enabled",
    "true",
    { timeout: 15000 },
  );
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 0.6, behavior: "instant" }),
  );
  await expect(page.locator("[data-archive-portal]")).toHaveAttribute(
    "data-phase",
    "opening",
  );
  expect(
    await page
      .locator("#mission h2")
      .evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("1");
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  for (const id of ["domains", "brief", "join"]) {
    await dial.locator(`a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(
      page.locator(`#${id} [data-reveal-entered="visible"]`).first(),
    ).toBeVisible();
  }
});

test("mobile reduced motion keeps all content exposed", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.locator('[data-reveal-state="armed"]')).toHaveCount(0);
  for (const id of ["mission", "domains", "brief", "join"]) {
    const heading = page.locator(`#${id} h2`);
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    expect(
      await heading.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "JOIN THE ARCHIVE" }),
  ).toBeVisible();
});
