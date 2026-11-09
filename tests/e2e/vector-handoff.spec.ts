import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
const drawing =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="150mm" viewBox="0 0 100 150"><g transform="translate(5 5)"><path id="shell" fill="#cccccc" stroke="#111111" stroke-width="1" d="M10 20 C15 0 55 0 60 20 L80 110 L0 110 Z"/><path id="pocket" fill="#ffffff" stroke="#111111" d="M25 40 Q35 35 45 40 L45 65 L25 65Z"/></g></svg>';
async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: "Open vector workspace" }).click();
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
}
test("SVG review, garment selection, keyboard transforms, undo, handoff and source retention", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const file = {
    name: "sample-shirt.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(drawing),
  };
  await page.getByLabel("Import SVG file", { exact: true }).setInputFiles(file);
  await expect(
    page.getByRole("dialog", { name: "Review SVG import" }),
  ).toBeVisible();
  await expect(page.getByText(/Original size: 100mm × 150mm/)).toBeVisible();
  const importAudit = await new AxeBuilder({ page })
    .include(".vector-review")
    .analyze();
  expect(importAudit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(0);
  await page.getByLabel("Import SVG file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Place SVG", exact: true }).click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(2);
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  const paths = page.locator("[data-vector-layer] > path:first-child");
  const before = await paths.evaluateAll((ns) =>
    ns.map((n) => n.getAttribute("d")),
  );
  await page
    .getByRole("spinbutton", { name: "Selection X", exact: true })
    .fill("50");
  await page
    .getByRole("spinbutton", { name: "Selection X", exact: true })
    .press("Enter");
  const moved = await paths.evaluateAll((ns) =>
    ns.map((n) => n.getAttribute("d")),
  );
  expect(moved.every((d, i) => d !== before[i])).toBe(true);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  expect(
    await paths.evaluateAll((ns) => ns.map((n) => n.getAttribute("d"))),
  ).toEqual(before);
  await page
    .getByRole("button", { name: "Lock selection", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Selection X", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock selection", exact: true })
    .click();
  const shell = page.getByRole("button", {
    name: "Select front shell",
    exact: true,
  });
  await shell.focus();
  await shell.press("ArrowRight");
  expect(
    await paths.evaluateAll((ns) => ns.map((n) => n.getAttribute("d"))),
  ).not.toEqual(before);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  expect(
    await paths.evaluateAll((ns) => ns.map((n) => n.getAttribute("d"))),
  ).toEqual(before);
  await page.getByText("Original SVG files (1/8)", { exact: true }).click();
  const originalDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save original SVG", exact: true })
    .click();
  const originalPath = info.outputPath("original.svg");
  await (await originalDownload).saveAs(originalPath);
  expect(await fs.readFile(originalPath, "utf8")).toBe(drawing);
  await page
    .getByRole("button", { name: "Remove saved original", exact: true })
    .click();
  await expect(
    page.getByText("Original SVG files (1/8)", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  await expect(
    page.getByText("Original SVG files (1/8)", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `qa/handoff-013/grouped-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Review production handoff" }),
  ).toBeVisible();
  await expect(page.getByText(/No back view is included/)).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include(".vector-review")
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: `qa/handoff-013/review-${info.project.name}.png`,
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export reviewed ZIP", exact: true })
    .click();
  const destination = info.outputPath("handoff.zip");
  await (await download).saveAs(destination);
  const zip = unzipSync(new Uint8Array(await fs.readFile(destination))),
    pack = JSON.parse(strFromU8(zip["editable-vector-pack.json"]));
  expect(pack.sources[0].original).toBe(drawing);
  expect(pack.groups[0].layerIds).toHaveLength(2);
  expect(pack.layers[0].nodes.some((n: any) => n.out)).toBe(true);
  expect(JSON.parse(strFromU8(zip["handoff-manifest.json"]))).toMatchObject({
    intent: "technical-flat",
    specificationUnits: "cm",
    recipientAcceptanceVerified: false,
  });
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await page
    .getByLabel("Import vector pack file", { exact: true })
    .setInputFiles({
      name: "project.json",
      mimeType: "application/json",
      buffer: Buffer.from(zip["editable-vector-pack.json"]),
    });
  await expect(page.locator("[data-vector-layer]")).toHaveCount(2);
  await shell.focus();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("bounded SVG converter preserves holes and styles, and refuses unsafe or lossy unsupported markup", async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(async () => {
    const path = "/src/vector-svg-import.ts";
    const { importSvg } = await import(path);
    const wrap = (s: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
    const bad = [
      "<script>alert(1)</script>",
      '<path d="M0 0L10"/>',
      '<path d="M0 0L1e999 4"/>',
      '<path d="M0 0L10 20" transform="translate(oops)"/>',
      '<image href="https://example.com/private.png"/>',
      '<path d="M0 0L1 1" filter="url(#a)"/>',
      "<text>Label</text>",
      '<path style="opacity:0.5" d="M0 0L1 1"/>',
      '<path class="a" d="M0 0L1 1"/>',
    ];
    const rejected = [];
    for (const s of bad) {
      try {
        await importSvg(wrap(s), "bad.svg", "front");
        rejected.push(false);
      } catch {
        rejected.push(true);
      }
    }
    const valid = await importSvg(
      wrap(
        '<path fill-rule="evenodd" fill="#369" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="bevel" d="M0 0H100V100H0Z M20 20H80V80H20Z"/>',
      ),
      "holes.svg",
      "front",
    );
    const ellipse = await importSvg(
      wrap('<ellipse rx="30" ry="20"/>'),
      "ellipse.svg",
      "front",
    );
    return {
      rejected,
      layer: valid.layers[0],
      ellipseWarnings: ellipse.warnings,
    };
  });
  expect(results.rejected.every(Boolean)).toBe(true);
  expect(results.layer).toMatchObject({
    fill: "#336699",
    fillRule: "evenodd",
    lineCap: "square",
    lineJoin: "bevel",
  });
  expect(results.layer.contours).toHaveLength(1);
  expect(results.ellipseWarnings.join(" ")).toContain("96 straight segments");
  await page.getByLabel("Import SVG file", { exact: true }).setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ),
  });
  await expect(page.getByText(/SVG not imported/)).toBeVisible();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(0);
});
