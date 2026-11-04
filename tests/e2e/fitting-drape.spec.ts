import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("local two-view body fitting, residual export and saved personal surface", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByRole("button", { name: "Personal body fitting" }).click();
  const dialog = page.getByRole("dialog", { name: "Personal body fitting" });
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    const x = c.getContext("2d")!;
    x.fillStyle = "#eee";
    x.fillRect(0, 0, 600, 900);
    return c.toDataURL();
  });
  const marks = {
    top: [50, 5],
    floor: [50, 95],
    neck: [50, 15],
    chestLeft: [35, 28],
    chestRight: [65, 28],
    waistLeft: [38, 40],
    waistRight: [62, 40],
    hipsLeft: [34, 49],
    hipsRight: [66, 49],
  };
  for (const view of ["front", "side"]) {
    await dialog.getByLabel("Fitting photograph view").selectOption(view);
    await dialog.locator("input[type=file]").setInputFiles({
      name: `${view}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
    for (const [key, p] of Object.entries(marks)) {
      await dialog
        .getByLabel("Fitting landmark", { exact: true })
        .selectOption(key);
      await dialog.getByLabel("Fitting landmark X percent").fill(String(p[0]));
      await dialog.getByLabel("Fitting landmark Y percent").fill(String(p[1]));
    }
  }
  await dialog
    .getByRole("button", { name: "Optimize body fit locally" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Apply fitted body" }),
  ).toBeVisible({ timeout: 65000 });
  await expect(dialog.locator("tbody tr")).toHaveCount(6);
  await dialog.getByRole("button", { name: "Apply fitted body" }).click();
  await page.screenshot({
    path: `qa/next-features/body-fit-${info.project.name}.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include(".body-fit")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Close body fitting" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const path = info.outputPath("personal.formstudio");
  await (await download).saveAs(path);
  const p = JSON.parse(await fs.readFile(path, "utf8"));
  expect(p.body.fitting.scales).toHaveLength(6);
  expect(p.bodyStudy.result.residuals).toHaveLength(6);
  expect(errors).toEqual([]);
});
test("pattern panels, stitched drape and cylinder benchmark run in the worker", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: "3D drape studio" }).click();
  const d = page.getByRole("dialog", { name: "Garment drape studio" });
  await d.getByRole("button", { name: "Prepare bodice starter" }).click();
  await expect(d.getByRole("button", { name: "Run visual drape" })).toBeEnabled(
    { timeout: 30000 },
  );
  await d.getByRole("button", { name: "Run visual drape" }).click();
  await expect(
    d.getByRole("button", { name: "Export drape report" }),
  ).toBeVisible({ timeout: 65000 });
  await page.screenshot({
    path: `qa/next-features/bodice-drape-${info.project.name}.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include(".cloth-studio")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "Export drape report" }).click();
  const path = info.outputPath("drape.json");
  await (await download).saveAs(path);
  const report = JSON.parse(await fs.readFile(path, "utf8"));
  expect(report.validated).toBe(false);
  expect(report.vertices).toBeGreaterThan(100);
  expect(Number.isFinite(report.p95EdgeStrain)).toBe(true);
  expect(report.seamGapMm).toBeLessThan(10);
  await d.getByRole("button", { name: "Cylinder drape benchmark" }).click();
  await d.getByRole("button", { name: "Run visual drape" }).click();
  await expect(d.getByLabel("Physical drape drop (mm)")).toBeVisible({
    timeout: 65000,
  });
  await d.getByLabel("Physical drape drop (mm)").fill("150");
  await expect(
    d.getByText(/Physical observation entered by you/),
  ).toBeVisible();
  await page.screenshot({
    path: `qa/next-features/cylinder-drape-${info.project.name}.png`,
  });
  expect(errors).toEqual([]);
});
