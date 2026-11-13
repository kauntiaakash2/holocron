import { expect, test } from "@playwright/test";

test.describe("phone touch gestures", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    viewport: { width: 375, height: 812 },
  });

  test("touch activates the artifact and the ripple settles without a hover pointer", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    const control = page.getByRole("button", {
      name: "Activate Jedi Holocron",
    });
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(control).toHaveAttribute("aria-disabled", "true");
    const displacement = page.locator("#archive feDisplacementMap");
    await expect(displacement).toHaveAttribute("scale", "95");
    await expect(displacement).toHaveAttribute("scale", "0", { timeout: 5000 });
    await expect(control).toHaveAttribute("aria-disabled", "false", {
      timeout: 6000,
    });
  });

  test("horizontal rotation and vertical page scrolling remain distinct native gestures", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    const control = page.getByRole("button", {
      name: "Activate Jedi Holocron",
    });
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!,
      x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 6; i++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + i * 12, y }],
        });
        await page.waitForTimeout(20);
      }
      await expect(control).toHaveAttribute("data-dragging", "true");
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(control).toHaveAttribute("data-dragging", "false");
      expect(await page.evaluate(() => scrollY)).toBeLessThan(3);
      await expect(control).toHaveAttribute("aria-disabled", "false");
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 8; i++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - i * 24 }],
        });
        await page.waitForTimeout(20);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(30);
      await expect(control).toHaveAttribute("data-dragging", "false");
      await expect(
        page.getByRole("button", { name: "Open section navigation" }),
      ).toBeVisible();
    } finally {
      await session.detach();
    }
  });
});

test("content, organizer branding and forms fit phone, tablet, landscape and desktop viewports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [768, 1024],
    [844, 390],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const brand = page.getByRole("group", { name: "Organizers" });
    await expect(brand).toBeVisible();
    expect(
      await brand.evaluate((element) => {
        const children = [...element.querySelectorAll("img,span")];
        return children.every((child) => {
          const box = child.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth;
        });
      }),
    ).toBe(true);
    await expect(page.locator("#domains .domain")).toHaveCount(6);
    await page.locator("#brief").scrollIntoViewIfNeeded();
    await expect(page.locator("#brief")).toContainText("22 December 2026");
    await expect(page.locator("#brief")).toContainText(
      "Exactly 3 eligible participants",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/register");
  const input = page.locator("input:not([type=hidden])").first();
  await expect(input).toBeVisible();
  expect(
    await input.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  await input.focus();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
