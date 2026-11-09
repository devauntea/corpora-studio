import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [width, height] of [
  [1100, 760],
  [1280, 800],
  [1440, 940],
]) {
  test(`tattoo editors keep previews, controls and focus usable at ${width}×${height}`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Solar botanical" }),
    ).toBeVisible();
    await expect(page.locator(".canvas-host")).toHaveAttribute(
      "data-rendered-body",
      /full-arm/,
    );
    const capture = async (name: string) =>
      page.screenshot({
        path: `qa/final-ux/tattoo-after/${info.project.name}-${width}-${name}.png`,
      });
    await capture("workspace");
    await page
      .getByRole("button", { name: /Edit source in image studio/ })
      .click();
    const art = page.getByRole("dialog", { name: "Tattoo image studio" });
    await expect
      .poll(() =>
        art.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
      )
      .toBe(600);
    const stencilButton = art.getByRole("button", { name: "Stencil output" });
    expect((await stencilButton.boundingBox())!.width).toBeGreaterThan(90);
    expect(
      await stencilButton.evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
    await stencilButton.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      art.getByRole("button", { name: "Apply to artwork", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(stencilButton).toBeFocused();
    await capture("artwork");
    await stencilButton.click();
    const stencil = page.getByRole("dialog", {
      name: "Calibrated stencil studio",
    });
    await expect(page.locator(".artwork-studio")).toHaveAttribute("inert", "");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const bodyHeight = await stencil
      .locator(".stencil-body")
      .evaluate((e) => e.clientHeight);
    expect(bodyHeight).toBeGreaterThan(450);
    await stencil.locator(".stencil-preflight summary").click();
    expect(
      await stencil.locator(".stencil-body").evaluate((e) => e.clientHeight),
    ).toBe(bodyHeight);
    await stencil
      .getByRole("button", { name: "Trace artwork", exact: true })
      .click();
    await expect(
      stencil.getByRole("button", { name: "Export stencil PNG" }),
    ).toBeEnabled();
    await stencil.locator("aside").evaluate((e) => {
      e.scrollTop = 0;
    });
    await capture("stencil");
    if (width === 1100) {
      expect(
        (
          await new AxeBuilder({ page })
            .include(".tattoo-stencil")
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await stencil.getByRole("button", { name: "Close stencil studio" }).click();
    await expect(art).toBeVisible();
    await art.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: /Choose body/ }).click();
    const models = page.getByRole("dialog", { name: "Find your canvas." });
    await expect(
      models.getByRole("button", { name: "Use full arm", exact: true }),
    ).toBeInViewport();
    expect(
      await models
        .locator(".body-library-results")
        .evaluate((e) => e.clientHeight),
    ).toBeGreaterThan(400);
    await capture("body-library");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Pose & sleeve study", exact: true })
      .click();
    const study = page.getByRole("dialog", {
      name: "Tattoo composition study",
    });
    await expect(study.getByRole("status")).toContainText(
      "cameras stay linked",
      { timeout: 90_000 },
    );
    expect(
      await study.locator(".pose-pair").evaluate((e) => e.clientHeight),
    ).toBeGreaterThan(350);
    expect(
      await study
        .locator(".planning-main")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    await capture("planning");
    await study.getByRole("button", { name: "Close study" }).click();
    await page
      .getByRole("button", { name: "Review room", exact: true })
      .click();
    const review = page.getByRole("dialog", { name: "Review room" });
    await expect(
      review.getByRole("button", { name: "Return to studio" }),
    ).toBeInViewport();
    expect(
      await review.locator(".review-room-main").evaluate((e) => e.clientHeight),
    ).toBeGreaterThan(450);
    await capture("review-room");
    await review.getByRole("button", { name: "Close review room" }).click();
    expect(errors).toEqual([]);
  });
}
