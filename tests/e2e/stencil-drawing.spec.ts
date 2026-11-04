import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test("drawing, cancellable trace, calibrated PNG/PDF and groups", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  const original = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "#111";
    x.lineWidth = 5;
    x.strokeRect(45, 45, 165, 165);
    return c.toDataURL();
  });
  await page
    .getByLabel("Artwork file", { exact: true })
    .setInputFiles({
      name: "Print test.png",
      mimeType: "image/png",
      buffer: Buffer.from(original.split(",")[1], "base64"),
    });
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  const dialog = page.getByRole("dialog", { name: "Tattoo image studio" });
  await dialog.getByRole("button", { name: "Draw", exact: true }).click();
  const canvas = dialog.getByLabel("Artwork cleanup canvas");
  await expect
    .poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(256);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Stencil output" }).click();
  const stencil = page.getByRole("dialog", {
    name: "Calibrated stencil studio",
  });
  await stencil
    .getByRole("button", { name: "Trace artwork", exact: true })
    .click();
  await expect(
    stencil.getByRole("button", { name: "Export stencil PNG" }),
  ).toBeEnabled();
  await stencil.getByLabel("Stencil width (mm)", { exact: true }).fill("120");
  await stencil.getByLabel("Measured square width (mm)").fill("49");
  await stencil
    .getByLabel("Printer name", { exact: true })
    .fill("Test printer");
  await stencil
    .getByRole("button", { name: "Save printer calibration" })
    .click();
  const png = page.waitForEvent("download");
  await stencil.getByRole("button", { name: "Export stencil PNG" }).click();
  const file = info.outputPath("stencil.png");
  await (await png).saveAs(file);
  const bytes = await fs.readFile(file),
    index = bytes.indexOf("pHYs");
  expect(index).toBeGreaterThan(0);
  expect(bytes.readUInt32BE(index + 4)).toBe(11811);
  const pdf = page.waitForEvent("download");
  await stencil.getByRole("button", { name: "Export stencil PDF" }).click();
  await (await pdf).saveAs(info.outputPath("stencil.pdf"));
  await page.screenshot({
    path: `qa/next-features/stencil-${info.project.name}.png`,
  });
  const a11y = await new AxeBuilder({ page })
    .include(".stencil-studio")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await stencil.getByRole("button", { name: "Close stencil studio" }).click();
  await dialog
    .getByRole("button", { name: "Apply to artwork", exact: true })
    .click();
  await page.getByText("Layer groups (0)", { exact: true }).click();
  await page.getByLabel("New layer group name").fill("Sleeve study");
  await page
    .getByRole("button", { name: "Create group with selected layer" })
    .click();
  await expect(page.getByLabel("Layer group", { exact: true })).not.toHaveValue(
    "",
  );
  await page.getByLabel("Lock Sleeve study", { exact: true }).check();
  await expect(page.getByLabel("Layer group", { exact: true })).toBeDisabled();
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const projectPath = info.outputPath("drawn.formstudio");
  await (await save).saveAs(projectPath);
  const project = JSON.parse(await fs.readFile(projectPath, "utf8"));
  expect(
    project.assets.find((a: { name: string }) => a.name === "Print test.png")
      .edits.drawing,
  ).toHaveLength(1);
  expect(project.groups).toHaveLength(1);
  expect(errors).toEqual([]);
});
