import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const [width, height] of [
  [1080, 720],
  [1440, 940],
]) {
  test(`shared identity keeps model tools clear and ink presets editable at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".canvas-host")).toHaveAttribute(
      "data-rendered-body",
      /full-arm/,
    );
    const subtitle = await page.locator(".viewport-heading p").boundingBox();
    const context = await page.locator(".canvas-context").boundingBox();
    expect(context!.y).toBeGreaterThanOrEqual(
      subtitle!.y + subtitle!.height + 4,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", {name: "Draw on model (B)", exact: true}).click();
    const brush = await page.locator(".surface-brush").boundingBox();
    expect(brush!.y).toBeGreaterThanOrEqual(context!.y + context!.height + 4);
    await page.getByRole("button", {name: "Orbit view (V)", exact: true}).click();
    await page
      .getByLabel("Ink preview", { exact: true })
      .selectOption("custom");
    await page.getByRole("button", { name: "Indigo ink", exact: true }).click();
    await expect(page.getByLabel("Custom ink color")).toHaveValue("#27324c");
    await expect(
      page.getByRole("button", { name: "Indigo ink", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Undo/ }).click();
    await expect(page.getByLabel("Custom ink color")).not.toHaveValue(
      "#27324c",
    );
    await page
      .getByRole("button", { name: "Studio home", exact: true })
      .click();
    const home = page.getByRole("dialog", { name: "Studio home" });
    expect(await home.evaluate((e) => getComputedStyle(e).animationName)).toBe(
      "none",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".studio-home")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Studio home", exact: true }),
    ).toBeFocused();
  });
}
