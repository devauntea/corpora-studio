import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

async function sourceFixture(page: Page, kind: "pattern" | "garment" | "back") {
  const data = await page.evaluate((kind) => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 1000;
    const g = c.getContext("2d")!;
    g.fillStyle = "white";
    g.fillRect(0, 0, 800, 1000);
    g.strokeStyle = "#161616";
    g.fillStyle = "#252525";
    g.lineWidth = 4;
    if (kind === "pattern") {
      g.strokeRect(100, 100, 450, 600);
      g.font = "20px sans-serif";
      g.fillText("FRONT", 230, 350);
    } else {
      g.beginPath();
      g.moveTo(160, 150);
      g.lineTo(300, 90);
      g.quadraticCurveTo(400, kind === "back" ? 145 : 240, 500, 90);
      g.lineTo(640, 150);
      g.quadraticCurveTo(600, 240, 640, 310);
      g.lineTo(640, 750);
      g.lineTo(160, 750);
      g.lineTo(160, 310);
      g.quadraticCurveTo(200, 240, 160, 150);
      g.closePath();
      g.fill();
    }
    return c.toDataURL("image/png");
  }, kind);
  return {
    name: `owned-${kind}-fixture.png`,
    mimeType: "image/png",
    buffer: Buffer.from(data.split(",")[1], "base64"),
  };
}
async function importFixture(
  page: Page,
  room: Locator,
  name: string,
  file: Awaited<ReturnType<typeof sourceFixture>>,
) {
  const choice = page.waitForEvent("filechooser");
  await room.getByRole("button", { name, exact: true }).click();
  await (await choice).setFiles(file);
  await expect(room.getByLabel("Source study name")).toHaveValue(
    file.name.replace(/\.png$/, ""),
  );
}
async function calibrate(room: Locator) {
  await room
    .getByText("Add a point with keyboard coordinates", { exact: true })
    .click();
  for (const [x, y] of [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ]) {
    await room.getByLabel("New source point X percent").fill(String(x));
    await room.getByLabel("New source point Y percent").fill(String(y));
    await room
      .getByRole("button", { name: "Add reference corner", exact: true })
      .click();
  }
  await room.getByLabel("Reference width (mm)", { exact: true }).fill("800");
  await room.getByLabel("Reference width (mm)", { exact: true }).press("Enter");
  await room.getByLabel("Reference height (mm)", { exact: true }).fill("1000");
  await room
    .getByLabel("Reference height (mm)", { exact: true })
    .press("Enter");
  await room
    .getByRole("checkbox", { name: /I measured this rectangle/ })
    .check();
  await room
    .getByRole("button", { name: "Detect closed outlines", exact: true })
    .click();
  await expect(room.getByRole("status")).toContainText("closed shape", {
    timeout: 20000,
  });
}

test("pattern originals become calibrated editable pieces, retain corrections and survive save/open", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  // Source-module microbenchmark is development-only; the same real import UI
  // below is exercised unchanged against the bundled production build.
  if (!info.project.name.includes("production")) {
    const metrics = await page.evaluate(async () => {
      const path = "/src/pattern-source.ts";
      const { detectPatternOutlines } = await import(/* @vite-ignore */ path);
      const width = 1200,
        height = 1200;
      const data = new Uint8ClampedArray(width * height * 4).fill(255);
      for (let y = 100; y <= 1100; y++)
        for (let x = 100; x <= 1100; x++) {
          if (x > 102 && x < 1098 && y > 102 && y < 1098) continue;
          const p = (y * width + x) * 4;
          data[p] = data[p + 1] = data[p + 2] = 0;
        }
      const durations = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const outlines = detectPatternOutlines(
          { width, height, data },
          { kind: "pattern", threshold: 145, inverse: false, tolerancePx: 1 },
        );
        if (outlines.length !== 1)
          throw new Error("Maximum-size fixture detection failed");
        durations.push(Math.round((performance.now() - start) * 10) / 10);
      }
      return { raster: "1200×1200 RGBA", durationsMs: durations };
    });
    expect(Math.max(...metrics.durationsMs)).toBeLessThan(5000);
    await fs.writeFile(
      info.outputPath("outline-performance.json"),
      JSON.stringify(metrics, null, 2),
    );
  }
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", { name: "Open pattern image inventory" })
    .click();
  const room = page.getByRole("dialog", { name: "From reference to pattern" });
  await expect(room).toBeVisible();
  const file = await sourceFixture(page, "pattern");
  await importFixture(page, room, "Import pattern image", file);
  await calibrate(room);
  await expect(room.locator(".ps-dimensions")).toHaveText(
    /44[6-9]\.\d × 59[6-9]\.\d mm/,
  );
  const referenceWidth = room.getByLabel("Reference width (mm)", {
    exact: true,
  });
  await referenceWidth.fill("2500");
  await referenceWidth.press("Enter");
  await expect(referenceWidth).toHaveValue("2500");
  await expect(referenceWidth).toHaveAttribute("aria-invalid", "true");
  await expect(room.getByRole("alert")).toContainText("10–2000 mm");
  await expect(
    room.getByRole("button", {
      name: "Create editable pattern piece",
      exact: true,
    }),
  ).toBeDisabled();
  await referenceWidth.fill("800");
  await referenceWidth.press("Enter");
  await room
    .getByRole("checkbox", { name: /I measured this rectangle/ })
    .check();
  await expect(referenceWidth).toHaveAttribute("aria-invalid", "false");
  await room
    .getByLabel("Source provenance")
    .fill("Self-authored test drawing; known 800 × 1000 mm image frame.");
  await room.getByLabel("Source permission status").selectOption("own");
  await room
    .getByRole("button", { name: "Create editable pattern piece", exact: true })
    .click();
  await expect(room.locator(".ps-piece")).toHaveCount(1);
  await room
    .getByRole("button", { name: "Edit geometry & markings", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Pattern geometry editor" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Manual piece name").fill("Confirmed front panel");
  await editor
    .getByLabel("Piece cut instruction")
    .fill("Cut 1; seam boundary verified");
  await editor.getByRole("button", { name: "Add notch", exact: true }).click();
  await editor.locator('[data-grain="0"]').click();
  await editor.getByLabel("Point X", { exact: true }).fill("200");
  await editor.getByLabel("Point X", { exact: true }).press("Enter");
  await editor
    .getByRole("button", { name: "Close pattern geometry editor" })
    .click();
  await expect(
    room.getByRole("heading", { name: "Confirmed front panel" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include(".pattern-source-studio")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await room.locator(".ps-main").evaluate((n) => {
    n.scrollTop = 0;
  });
  await page.screenshot({
    path: info.outputPath("pattern-source-desktop.png"),
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await room.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: info.outputPath("pattern-source-compact.png"),
  });
  await page.setViewportSize({ width: 540, height: 820 });
  await expect(
    room.getByRole("button", { name: /owned-pattern-fixture Pattern image/ }),
  ).toBeVisible();
  await room
    .getByRole("button", { name: /owned-pattern-fixture Pattern image/ })
    .click();
  await expect(room.getByLabel("Source study name")).toHaveValue(
    "owned-pattern-fixture",
  );
  expect(await room.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath("pattern-source-narrow.png") });
  await page.setViewportSize({ width: 1440, height: 940 });
  await room.getByRole("button", { name: "Use these pieces in draft" }).click();
  await expect(room).not.toBeVisible();
  await expect(page.locator("[data-piece]")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = info.outputPath("imported-pattern.formstudio");
  await (await download).saveAs(saved);
  const project = JSON.parse(await fs.readFile(saved, "utf8")),
    study = project.fashion.patternSources.studies[0];
  expect(study.pieces[0].construction.notches).toHaveLength(1);
  expect(study.pieces[0].construction.grain[0].x).toBe(200);
  expect(study.pieces[0].construction.name).toBe("Confirmed front panel");
  const original = project.assets.find(
    (a: { id: string }) => a.id === study.primaryAssetId,
  );
  expect(Buffer.from(original.data.split(",")[1], "base64")).toEqual(
    file.buffer,
  );
  expect(study.calibration.confirmed).toBe(true);
  expect(project.fashion.customDraftIds).toEqual([study.pieces[0].id]);
  await page.getByLabel("Project file", { exact: true }).setInputFiles(saved);
  await page
    .getByRole("button", { name: "Open pattern image inventory" })
    .click();
  await expect(
    room.getByRole("heading", { name: "Confirmed front panel" }),
  ).toBeVisible();
  await expect(room.getByLabel("Source permission status")).toHaveValue("own");
  expect(errors).toEqual([]);
});

test("garment flat lay keeps multiple originals and generates only an explicitly confirmed approximate shell", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", { name: "Open pattern image inventory" })
    .click();
  const room = page.getByRole("dialog", { name: "From reference to pattern" });
  const front = await sourceFixture(page, "garment"),
    back = await sourceFixture(page, "back");
  await importFixture(page, room, "Reconstruct garment", front);
  const chooser = page.waitForEvent("filechooser");
  await room
    .getByRole("button", { name: "Add references", exact: true })
    .click();
  await (await chooser).setFiles(back);
  await expect(
    room.getByRole("button", { name: `Analyze reference ${back.name}` }),
  ).toBeVisible();
  await calibrate(room);
  const generate = room.getByRole("button", {
    name: "Generate approximate pieces",
    exact: true,
  });
  await expect(generate).toBeDisabled();
  await room
    .getByRole("button", {
      name: "Use measured silhouette dimensions",
      exact: true,
    })
    .click();
  await room
    .getByRole("checkbox", {
      name: "I checked these garment and body measurements.",
    })
    .check();
  await room
    .getByRole("checkbox", { name: /I accept the unshaped sleeveless shell/ })
    .check();
  await generate.click();
  await expect(room.locator(".ps-piece")).toHaveCount(2);
  await expect(
    room.getByRole("heading", { name: "Approximate box top · front" }),
  ).toBeVisible();
  await expect(
    room.getByRole("heading", { name: "Approximate box top · back" }),
  ).toBeVisible();
  await room.locator(".ps-pieces").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("garment-reconstruction-pieces.png"),
  });
  await room.getByRole("button", { name: "Use these pieces in draft" }).click();
  await expect(page.locator("[data-piece]")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = info.outputPath("garment-reconstruction.formstudio");
  await (await download).saveAs(saved);
  const project = JSON.parse(await fs.readFile(saved, "utf8")),
    study = project.fashion.patternSources.studies[0];
  expect(study.sourceAssetIds).toHaveLength(2);
  expect(study.pieces).toHaveLength(2);
  expect(
    study.pieces.every((p: { origin: string }) => p.origin === "approximate"),
  ).toBe(true);
  expect(
    study.reconstruction.measurementsConfirmed &&
      study.reconstruction.constructionConfirmed,
  ).toBe(true);
  expect(project.fashion.customDraftIds).toHaveLength(2);
  expect(errors).toEqual([]);
});
