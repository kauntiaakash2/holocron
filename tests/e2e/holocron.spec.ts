import { expect, test } from "@playwright/test";

test("clean hero retains scrollable event sections and registration access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  const artifact = page.locator("[data-holocron-state]");
  await expect(artifact).toHaveAttribute("data-holocron-state", "ready");
  await expect(artifact.locator("canvas")).toHaveCount(1);
  const control = page.getByRole("button", { name: "Activate Jedi Holocron" });
  const box = await control.boundingBox();
  await page.mouse.click(box!.x + 8, box!.y + 8);
  await expect(artifact.getByRole("status")).not.toHaveText(
    "ARCHIVE ACTIVATED",
  );
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(control).toHaveAttribute("data-hovered", "true");
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 100,
    box!.y + box!.height / 2 + 20,
    { steps: 12 },
  );
  await expect(control).toHaveAttribute("data-dragging", "true");
  await page.mouse.up();
  await expect(control).toHaveAttribute("data-dragging", "false");
  await expect(artifact.getByRole("status")).not.toHaveText(
    "ARCHIVE ACTIVATED",
  );
  await control.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Activate Jedi Holocron" }).focus();
  await page.keyboard.press("Enter");
  await expect(artifact.getByRole("status")).toHaveText("ARCHIVE ACTIVATED");
  await expect(artifact.getByRole("status")).toHaveText(
    "ACTIVATE THE ARTIFACT ↗",
    { timeout: 6000 },
  );
  await expect(page.getByRole("button", { name: "Pause motion" })).toHaveCount(
    0,
  );
  await page.locator("#mission").scrollIntoViewIfNeeded();
  await expect(page.locator("#mission")).toBeVisible();
  await expect(page.locator("#domains .domain")).toHaveCount(6);
  await expect(page.locator("#brief")).toContainText("22 December 2026");
  await page.locator('#brief a[href="/register"]').click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.locator("input").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced-motion artifact fits all target widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const artifact = page.locator("[data-holocron-state]");
    await artifact.scrollIntoViewIfNeeded();
    await expect(artifact).toHaveAttribute("data-holocron-state", "ready");
    await expect(artifact).toHaveAttribute("data-motion", "reduced");
    await expect(
      page.getByRole("button", { name: "Pause motion" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = await artifact.boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - 500)).toBeLessThan(2);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `output/playwright/holocron-${width}.png` });
  }
});

test("unavailable WebGL preserves the derived fallback and navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(original, {
      apply(target, receiver, args) {
        if (String(args[0]).startsWith("webgl")) return null;
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await page.goto("/");
  const artifact = page.locator("[data-holocron-state]");
  await artifact.scrollIntoViewIfNeeded();
  await expect(artifact).toHaveAttribute("data-holocron-state", "failed");
  await expect(artifact.getByRole("img")).toBeVisible();
  await expect(artifact.locator("canvas")).toHaveCount(0);
  await expect(artifact.getByRole("button")).toHaveCount(0);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/register/);
});
