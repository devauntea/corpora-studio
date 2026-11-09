import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

test("pattern previews stage size changes and retain measurements and manual pieces", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  const beforeName = await page
    .getByLabel("Measurement profile name")
    .inputValue();
  const beforeChest = await page
    .getByRole("spinbutton", { name: "Chest / full bust", exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByRole("button", { name: "Add custom pattern piece" }).click();
  const originalPieces = await page.locator(".pattern-piece").count();
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview & apply starter size" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pattern catalog",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator(".pattern-preview-card img").first(),
  ).toBeVisible();
  expect(
    (await dialog.locator(".pattern-preview-card").first().boundingBox())!
      .height,
  ).toBeGreaterThan(180);
  await expect(
    dialog.getByRole("img", { name: /Teagan.*drafted preview/ }),
  ).toBeVisible();
  await dialog.getByLabel("Preview body profile").selectOption("female");
  await dialog
    .getByRole("group", { name: "Preview starter size" })
    .getByRole("button", { name: "S", exact: true })
    .click();
  await expect(page.getByLabel("Measurement profile name")).toHaveValue(
    beforeName,
  );
  await expect(
    page.getByRole("spinbutton", { name: "Chest / full bust", exact: true }),
  ).toHaveValue(beforeChest);
  await dialog.getByLabel("Search pattern library").fill("trouser block");
  await expect(
    dialog.getByRole("button", { name: /Preview Titan/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Preview Titan/ }).click();
  await expect(
    dialog.getByRole("img", { name: /Titan.*drafted preview/ }),
  ).toBeVisible();
  await dialog.getByLabel("Search pattern library").fill("teagan");
  await dialog.getByRole("button", { name: /Preview Teagan/ }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".pattern-catalog-dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const dimensions = await dialog.evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    scrollWidth: el.scrollWidth,
    scrollHeight: el.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  await page.screenshot({
    path: `qa/final-development/pattern-browser-${info.project.name}-1100.png`,
  });
  await dialog
    .getByRole("button", { name: "Use this pattern", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Chest / full bust", exact: true }),
  ).toHaveValue("830");
  await expect(page.locator(".pattern-piece")).toHaveCount(originalPieces);
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const path = info.outputPath("starter-profile.formstudio");
  await (await save).saveAs(path);
  const saved = JSON.parse(await fs.readFile(path, "utf8"));
  expect(saved.fashion.profile).toBe("Female S · chart-based starter");
  expect(
    saved.fashion.profiles.some(
      (p: { name: string; measurements: { chest: number } }) =>
        p.name === beforeName && p.measurements.chest === Number(beforeChest),
    ),
  ).toBe(true);
  expect(Object.keys(saved.fashion.construction)).toHaveLength(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByLabel("Measurement profile name")).toHaveValue(
    beforeName,
  );
  await expect(page.locator(".pattern-piece")).toHaveCount(originalPieces);
  await page.getByLabel("Project file", { exact: true }).setInputFiles(path);
  const discard = page.getByRole("button", { name: "Discard" });
  if (await discard.isVisible()) await discard.click();
  await expect(
    page.getByRole("spinbutton", { name: "Chest / full bust", exact: true }),
  ).toHaveValue("830");
  expect(errors).toEqual([]);
});
