import { expect, test } from "@playwright/test";

test("desktop dial follows scrolling and supports keyboard destinations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  await expect(dial).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 12, behavior: "instant" }));
  await expect(dial).toBeVisible();
  await expect(dial.getByRole("link")).toHaveCount(5);
  await page.locator("#mission").scrollIntoViewIfNeeded();
  await expect(dial.getByRole("link", { name: /The mission/ })).toHaveAttribute(
    "aria-current",
    "location",
  );
  await dial.getByRole("link", { name: /The mission/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    dial.getByRole("link", { name: /Challenge domains/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#domains$/);
  await expect(page.locator("#domains")).toBeFocused();
  await expect(
    dial.getByRole("link", { name: /Challenge domains/ }),
  ).toHaveAttribute("aria-current", "location");
  await page.locator("#join").scrollIntoViewIfNeeded();
  await expect(
    dial.getByRole("link", { name: /Join the archive/ }),
  ).toHaveAttribute("aria-current", "location");
});

test("mobile dial opens, navigates, closes and fits the viewport", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  const toggle = page.getByRole("button", { name: "Open section navigation" });
  await expect(toggle).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 12, behavior: "instant" }));
  await expect(toggle).toBeVisible();
  await expect(dial).toBeHidden();
  await toggle.click();
  await expect(dial).toBeVisible();
  await dial.getByRole("link", { name: /The mission/ }).click();
  await expect(page).toHaveURL(/#mission$/);
  await expect(dial).toBeHidden();
  await expect(page.locator("#mission")).toBeFocused();
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(dial).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("pointer navigation reaches the first selected destination and disappears at the hero top", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: 12, behavior: "instant" }));
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  await expect(dial).toBeVisible();
  const mission = dial.getByRole("link", { name: /The mission/ });
  const box = await mission.boundingBox();
  // Real down/up at one coordinate catches focus-induced moving-target bugs.
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await expect(page).toHaveURL(/#mission$/);
  await expect(page.locator("#mission")).toBeFocused();
  await dial.getByRole("link", { name: /The Holocron/ }).click();
  await expect(page).toHaveURL(/#archive$/);
  await expect(dial).toHaveCount(0);
});

test("wheel links stay still under the pointer and land without the removed header offset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  await page.evaluate(() => window.scrollTo({ top: 12, behavior: "instant" }));
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  await expect(dial.getByRole("link")).toHaveCount(5);
  for (const id of ["mission", "domains", "brief", "join"]) {
    const link = dial.locator(`a[href="#${id}"]`);
    await expect(link).toBeInViewport();
    await link.hover();
    const before = await link.boundingBox();
    await page.mouse.down();
    await page.waitForTimeout(100);
    const after = await link.boundingBox();
    expect(
      Math.abs(before!.x - after!.x) + Math.abs(before!.y - after!.y),
    ).toBeLessThan(1);
    await page.mouse.up();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator(`#${id}`)
          .evaluate(
            (element) =>
              Math.abs(element.getBoundingClientRect().top - 24) < 3 ||
              Math.abs(
                window.scrollY +
                  window.innerHeight -
                  document.documentElement.scrollHeight,
              ) < 3,
          ),
      )
      .toBe(true);
    await expect(link).toHaveAttribute("aria-current", "location");
  }
});

test("held wheel remains usable after desktop/mobile layout changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: 12, behavior: "instant" }));
  const dial = page.getByRole("navigation", { name: "Archive sections" });
  await dial.getByRole("link", { name: "The mission" }).hover();
  expect(
    await dial
      .locator("li")
      .first()
      .evaluate((element) => element.style.transform),
  ).not.toBe("");
  await page.setViewportSize({ width: 375, height: 812 });
  const toggle = page.getByRole("button", { name: "Open section navigation" });
  await toggle.click();
  await expect
    .poll(() =>
      dial
        .locator("li")
        .evaluateAll((items) =>
          items.every((item) => item.style.transform === ""),
        ),
    )
    .toBe(true);
  await dial.getByRole("link", { name: "Challenge domains" }).click();
  await expect(page).toHaveURL(/#domains$/);
  await expect(page.locator("#domains")).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(dial).toBeVisible();
  for (const link of await dial.getByRole("link").all()) {
    // Every label must remain a real hit target, not a stack of stale mobile
    // transforms. Check the actual hit test, not only bounding-box visibility.
    await expect
      .poll(() =>
        link.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            document
              .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
              ?.closest("a") === element
          );
        }),
      )
      .toBe(true);
  }
  await page.locator('#brief a[href="/register"]').scrollIntoViewIfNeeded();
  await page.locator('#brief a[href="/register"]').click();
  await expect(page).toHaveURL(/\/register$/);
});
