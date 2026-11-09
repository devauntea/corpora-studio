import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("garment catalog, profiles, size series and interchange", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByLabel("Garment design").selectOption("titan");
  await expect(
    page.getByRole("img", { name: "Sewing pattern canvas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add missing sample measurements" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Sewing pattern canvas" }),
  ).toBeVisible();
  await page.getByText("Profiles & size series", { exact: true }).click();
  await page.getByLabel("Measurement profile name").fill("Profile A");
  await page
    .getByRole("button", { name: "Keep current profile in project" })
    .click();
  await page.getByLabel("Measurement profile name").fill("Profile B");
  await page
    .getByRole("spinbutton", { name: "Waist", exact: true })
    .fill("900");
  await page
    .getByRole("spinbutton", { name: "Waist", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Keep current profile in project" })
    .click();
  const boxes = page.getByRole("checkbox", { name: "Include in size series" });
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page
    .getByRole("button", { name: "Compare sizes", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Nested pattern size comparison" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export grade check" }).click();
  expect((await download).suggestedFilename()).toBe("Grade check.csv");
  await page
    .getByRole("button", { name: "Pattern board", exact: true })
    .click();
  for (const design of ["brian", "sarah", "simon"]) {
    await page.getByLabel("Garment design").selectOption(design);
    await expect(
      page.getByRole("img", { name: "Sewing pattern canvas" }),
    ).toBeVisible();
  }
  await expect(page.locator(".pattern-piece")).toHaveCount(10);
  await page.screenshot({
    path: `qa/next-features/catalog-${test.info().project.name}.png`,
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .include(".fashion-workspace")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
