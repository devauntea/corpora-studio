import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1080, 720],
  [1440, 940],
]) {
  test(`vector panels reclaim canvas and preserve selection at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Fashion", exact: true }).click();
    await page.getByRole("button", { name: "Open vector workspace" }).click();
    const canvas = page.locator(".vector-canvas-scroll");
    await expect(canvas).toBeVisible();
    const before = await canvas.boundingBox();
    expect(before!.height).toBeGreaterThan(width === 1080 ? 305 : 515);
    const library = page.getByRole("button", {
      name: "Garment flats panel",
      exact: true,
    });
    const inspector = page.getByRole("button", {
      name: "Path inspector panel",
      exact: true,
    });
    await library.click();
    if ((await inspector.getAttribute("aria-expanded")) === "true")
      await inspector.click();
    const expanded = await canvas.boundingBox();
    expect(expanded!.width).toBeGreaterThan(before!.width + 170);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#vector-library-panel")).toBeHidden();
    await expect(page.locator("#vector-inspector-panel")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Draw path", exact: true }),
    ).toBeVisible();
    await library.click();
    await page
      .getByRole("button", { name: "Select front", exact: true })
      .click();
    await expect(inspector).toHaveAttribute("aria-expanded", "true");
    const count = await page.locator(".vector-selectionbar > span").innerText();
    expect(count).not.toBe("0 selected");
    await inspector.click();
    await expect(page.locator("#vector-inspector-panel")).toBeHidden();
    await inspector.click();
    await expect(page.locator(".vector-selectionbar > span")).toHaveText(count);
    await page.locator(".vector-export-help summary").click();
    await expect(page.locator("#vector-export-intent")).toBeVisible();
    await page.locator(".vector-export-help summary").click();
    await expect(page.locator("#vector-export-intent")).toBeHidden();
    await page.getByLabel("Vector export format").selectOption("svg");
    await expect(
      page.getByRole("button", { name: "Export vector pack", exact: true }),
    ).toBeEnabled();
  });
}
