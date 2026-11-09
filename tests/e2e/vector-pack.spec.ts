import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("vector drawings, editable geometry, specifications and manufacturer handoff round trip", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: /Vector packs/ }).click();
  await expect(
    page.getByRole("heading", { name: "T-shirt", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Garment flat template").selectOption("Hoodie");
  await page
    .getByRole("button", { name: "Replace flats", exact: true })
    .click();
  await page
    .getByLabel("Garment detail", { exact: true })
    .selectOption("Patch pocket");
  await page.getByRole("button", { name: "Add detail", exact: true }).click();
  await page.getByLabel("Vector layer name").fill("Contrast pocket");
  await page.getByLabel("Path fill", { exact: true }).fill("#747d70");
  const x = page.getByRole("spinbutton", { name: "Path X", exact: true });
  await x.fill("210");
  await x.press("Enter");
  const path = page.getByRole("button", {
    name: "Select front Contrast pocket",
    exact: true,
  });
  const before = await path.getAttribute("d");
  await page.getByRole("button", { name: "Edit points", exact: true }).click();
  const circle = page.locator('[data-vector-node="0"]');
  const cb = (await circle.boundingBox())!;
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.getByRole("button", { name: "Curve anchor", exact: true }).click();
  await expect(path).not.toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  await expect(path).toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Redo vector edit", exact: true })
    .click();
  await page.getByRole("button", { name: "Add callout", exact: true }).click();
  const canvas = page.getByRole("group", {
      name: "Front and back garment flats",
    }),
    box = (await canvas.boundingBox())!;
  // Use an exposed point on the front shell; preserve SVG viewBox mapping at fit zoom.
  const point = await canvas.evaluate((el) => {
    const m = (el as SVGSVGElement).getScreenCTM()!;
    const p = new DOMPoint(260, 320).matrixTransform(m);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(point.x, point.y);
  await page
    .getByLabel("Callout instruction")
    .fill("Twin needle topstitch around pocket opening.");
  await page
    .getByRole("button", { name: "Style & instructions", exact: true })
    .click();
  await page
    .getByLabel("Garment name", { exact: true })
    .fill("Studio utility hoodie");
  await page.getByLabel("Style code", { exact: true }).fill("FS-001");
  await page
    .getByLabel("Manufacturer instructions")
    .fill("Prototype in cotton fleece. Review sample before production.");
  await page
    .getByRole("button", { name: "Size specification", exact: true })
    .click();
  await page.getByLabel("Chest / hip width M", { exact: true }).fill("60");
  await page.getByLabel("Specification units").selectOption("in");
  await expect(
    page.getByLabel("Chest / hip width M", { exact: true }),
  ).toHaveValue("23.622");
  await page.getByLabel("Specification units").selectOption("cm");
  await page
    .getByRole("button", { name: "Materials & trims", exact: true })
    .click();
  await page.getByLabel("Material 1 description").fill("320 gsm cotton fleece");
  await page.getByLabel("Material 1 composition").fill("100% cotton");
  await page.getByLabel("Material 1 color").fill("Olive / approved swatch");
  await page
    .getByRole("button", { name: "Technical flats", exact: true })
    .click();
  await page.screenshot({
    path: `qa/fashion-expansion/vector-${info.project.name}.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .include(".vector-studio")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await page.getByRole("button", {name: "Export reviewed ZIP", exact: true}).click();
  const zip = info.outputPath("manufacturer.zip");
  const d = await download;
  expect(d.suggestedFilename()).toBe("FS-001-vector-pack.zip");
  await d.saveAs(zip);
  const entries = unzipSync(new Uint8Array(await fs.readFile(zip)));
  expect(strFromU8(entries["materials.csv"])).toContain(
    "320 gsm cotton fleece",
  );
  expect(strFromU8(entries["construction.csv"])).toContain("Twin needle");
  const pack = JSON.parse(strFromU8(entries["editable-vector-pack.json"]));
  expect(
    pack.layers.some((l: { name: string }) => l.name === "Contrast pocket"),
  ).toBe(true);
  expect(pack.measurements[0].values[1]).toBeCloseTo(60, 3);
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const projectPath = info.outputPath("vectors.formstudio");
  await (await save).saveAs(projectPath);
  expect(
    JSON.parse(await fs.readFile(projectPath, "utf8")).fashion.vectorPack,
  ).toEqual(pack);
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(0);
  await page.getByLabel("Import vector pack file").setInputFiles({
    name: "pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(entries["editable-vector-pack.json"]),
  });
  await expect(
    page.getByRole("button", {
      name: "Select front Contrast pocket",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pattern studio", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Sewing pattern canvas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  if (await discard.isVisible()) await discard.click();
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(projectPath);
  await page.getByRole("button", { name: /Vector packs/ }).click();
  await expect(
    page.getByRole("heading", { name: "Studio utility hoodie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Select front Contrast pocket",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(box.width).toBeGreaterThan(500);
});
test("expanded catalog searches and drafts across garment categories", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(page.getByLabel("Garment design").locator("option")).toHaveCount(
    65,
  );
  await page.getByLabel("Search patterns").fill("hood");
  await expect(page.getByLabel("Garment design").locator("option")).toHaveCount(
    5,
  );
  await page.getByLabel("Garment design").selectOption("hugo");
  await expect(page.getByRole("button", {
    name: "Add missing sample measurements", exact: true,
  })).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Sewing pattern canvas" }),
  ).toBeVisible();
  await page.getByLabel("Search patterns").fill("");
  await page.getByLabel("Garment design").selectOption("sasha");
  await expect(
    page.getByRole("img", { name: "Sewing pattern canvas" }),
  ).toBeVisible();
  for (const design of ["devon", "opal", "cathrin", "tina", "paco"]) {
    await page.getByLabel("Garment design").selectOption(design);
    await expect(
      page.getByRole("img", { name: "Sewing pattern canvas" }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: `qa/fashion-expansion/catalog-${info.project.name}.png`,
    fullPage: true,
  });
});

test("draw a custom flat, split curves, mirror and copy views with keyboard controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: /Vector packs/ }).click();
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await page.getByRole("button", { name: "Draw path", exact: true }).click();
  const svg = page.getByRole("group", { name: "Front and back garment flats" });
  for (const [x, y] of [
    [160, 160],
    [280, 160],
    [300, 420],
    [140, 420],
  ]) {
    const p = await svg.evaluate(
      (el, xy) => {
        const m = (el as SVGSVGElement).getScreenCTM()!;
        const p = new DOMPoint(xy[0], xy[1]).matrixTransform(m);
        return { x: p.x, y: p.y };
      },
      [x, y],
    );
    await page.mouse.click(p.x, p.y);
  }
  await page.getByRole("button", { name: "Finish path", exact: true }).click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(1);
  await page.getByLabel("Vector layer name").fill("Custom panel");
  await page.getByRole("button", { name: "Edit points", exact: true }).click();
  await page.getByLabel("Selected anchor").selectOption("0");
  await page.getByRole("button", { name: "Curve anchor", exact: true }).click();
  await page
    .getByRole("button", { name: "Insert anchor after", exact: true })
    .click();
  await expect(
    page.getByLabel("Selected anchor").locator("option"),
  ).toHaveCount(6);
  const path = page.getByRole("button", {
    name: "Select front Custom panel",
    exact: true,
  });
  const before = await path.getAttribute("d");
  await path.focus();
  await page.keyboard.press("ArrowRight");
  await expect(path).not.toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  await expect(path).toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Mirror horizontally", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy to back", exact: true }).click();
  await expect(page.getByLabel("Active garment view")).toHaveValue("back");
  await expect(
    page.getByRole("button", { name: "Select back Custom panel", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Lock path").check();
  await expect(
    page.getByRole("button", { name: "Delete path", exact: true }),
  ).toBeDisabled();
});
