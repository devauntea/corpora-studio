import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const [width, height] of [
  [1080, 720],
  [1440, 940],
]) {
  test(`fabric palette is readable and applies without altering linework at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Fashion", exact: true }).click();
    await page.getByRole("button", { name: /Vector packs/ }).click();
    await page
      .getByRole("button", { name: "Fabric & color", exact: true })
      .click();
    const mainFabric = page.getByRole("button", {
      name: "Open fabric and color workspace",
      exact: true,
    });
    const mainVectors = page.locator(".workspace-nav").getByRole("button", {
      name: "Open vector workspace",
      exact: true,
    });
    const fabricTab = page.locator(".vector-tabs").getByRole("button", {
      name: "Fabric & color",
      exact: true,
    });
    await expect(mainFabric).toHaveAttribute("aria-pressed", "true");
    await expect(mainVectors).toHaveAttribute("aria-pressed", "false");
    await mainVectors.click();
    await expect(page.locator(".vector-canvas")).toBeVisible();
    await expect(fabricTab).toHaveAttribute("aria-pressed", "false");
    await mainFabric.click();
    await expect(fabricTab).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Size specification", exact: true })
      .click();
    await expect(mainVectors).toHaveAttribute("aria-pressed", "true");
    await expect(mainFabric).toHaveAttribute("aria-pressed", "false");
    await fabricTab.click();
    await expect(mainFabric).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Fabric pattern Floral", exact: true })
      .click();
    const apply = page.getByRole("button", {
      name: "Apply fabric & color",
      exact: true,
    });
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
      const bounds = await apply.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThan(height - 25);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const checks = await new AxeBuilder({ page })
        .include(".textile-studio")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(checks.violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${width}-${theme}-fabric.png`),
      });
    }
    await apply.click();
    await page
      .getByRole("button", { name: "Technical flats", exact: true })
      .click();
    const paths = page.locator('.vector-canvas path[fill^="url(#textile-"]');
    await expect(paths).toHaveCount(2);
    await expect(
      page.locator('.vector-canvas path[fill="none"]').first(),
    ).toBeAttached();
    await page
      .getByRole("button", { name: "Undo vector edit", exact: true })
      .click();
    await expect(paths).toHaveCount(0);
    await page
      .getByRole("button", { name: "Fabric & color", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fabric pattern Leopard", exact: true })
      .click();
    await page
      .getByLabel("Fabric application target", { exact: true })
      .selectOption("back");
    await apply.click();
    await page
      .getByRole("button", { name: "Technical flats", exact: true })
      .click();
    await expect(paths).toHaveCount(1);
  });
}
