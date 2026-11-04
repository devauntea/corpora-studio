import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("manual curves, edge allowances, notches and darts persist independently of measurements", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit points & curves", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Pattern geometry editor" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Manual piece name").fill("Front / test");
  const options = await dialog
    .getByLabel("Boundary segment")
    .locator("option")
    .allTextContents();
  const curve = options.findIndex((s) => s.includes("Curve")) + 1;
  await dialog.getByLabel("Boundary segment").selectOption(String(curve));
  const cp = dialog.locator('[data-control="cp1"]'),
    box = (await cp.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(dialog.getByLabel("Point X")).toBeVisible();
  await dialog.getByLabel("Segment allowance").fill("18");
  await dialog.getByLabel("Segment allowance").press("Enter");
  await dialog
    .getByRole("button", { name: "Insert midpoint", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Double notch", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Add dart marking", exact: true })
    .click();
  await expect(dialog.locator("[data-dart]")).toHaveCount(3);
  await dialog
    .getByRole("button", { name: "Undo pattern edit", exact: true })
    .click();
  await expect(dialog.locator("[data-dart]")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Redo pattern edit", exact: true })
    .click();
  await expect(dialog.locator("[data-dart]")).toHaveCount(3);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("manual-pattern.png") });
  await dialog
    .getByRole("button", { name: "Close pattern geometry editor" })
    .click();
  const front = page
      .locator('[data-piece="front"] g')
      .first()
      .locator("path")
      .first(),
    before = await front.getAttribute("d");
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Chest / full bust", exact: true })
    .fill("1100");
  await page
    .getByRole("spinbutton", { name: "Chest / full bust", exact: true })
    .press("Enter");
  await expect(front).toHaveAttribute("d", before!);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("construction.formstudio");
  await (await download).saveAs(file);
  const stored = JSON.parse(await fs.readFile(file, "utf8"));
  expect(stored.version).toBe(9);
  expect(stored.fashion.construction.front.darts).toHaveLength(1);
  expect(stored.fashion.construction.front.allowances).toContain(18);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit points & curves", exact: true })
    .click();
  await expect(dialog.getByLabel("Manual piece name")).toHaveValue(
    "Front / test",
  );
  await expect(dialog.locator("[data-dart]")).toHaveCount(3);
  await dialog
    .getByRole("button", { name: "Close pattern geometry editor" })
    .click();
  await page
    .getByRole("button", { name: "Restore measurement draft", exact: true })
    .click();
  await expect(front).not.toHaveAttribute("d", before!);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(front).toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Print & export", exact: true })
    .click();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (await exported).saveAs(info.outputPath("manual-pattern.pdf"));
  expect(errors).toEqual([]);
});

test("stencil and contours export with transparency and preserve source bytes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  const original = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = "#222";
    x.fillRect(64, 64, 128, 128);
    return c.toDataURL();
  });
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles({
    name: "Contour.png",
    mimeType: "image/png",
    buffer: Buffer.from(original.split(",")[1], "base64"),
  });
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  const dialog = page.getByRole("dialog", { name: "Tattoo image studio" }),
    canvas = dialog.getByLabel("Artwork cleanup canvas");
  const alpha = (x: number, y: number) =>
    canvas.evaluate(
      (c: HTMLCanvasElement, p) =>
        c.getContext("2d")!.getImageData(p.x, p.y, 1, 1).data[3],
      { x, y },
    );
  await dialog.getByLabel("Artwork conversion").selectOption("stencil");
  await expect.poll(() => alpha(10, 10)).toBe(0);
  await expect.poll(() => alpha(128, 128)).toBe(255);
  await dialog.getByLabel("Artwork conversion").selectOption("line-art");
  await expect.poll(() => alpha(128, 128)).toBe(0);
  const edgeCount = () =>
    canvas.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, 256, 256).data;
      let count = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) count++;
      return count;
    });
  await expect.poll(edgeCount).toBeGreaterThan(300);
  await expect.poll(edgeCount).toBeLessThan(1200);
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect(dialog.getByLabel("Artwork conversion")).toHaveValue("stencil");
  await dialog
    .getByRole("button", { name: "Redo image edit", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export PNG", exact: true }).click();
  await (await download).saveAs(info.outputPath("contour.png"));
  await page.screenshot({ path: info.outputPath("ink-preparation.png") });
  await dialog
    .getByRole("button", { name: "Apply to artwork", exact: true })
    .click();
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("contour.formstudio");
  await (await save).saveAs(file);
  const p = JSON.parse(await fs.readFile(file, "utf8")),
    a = p.assets.find((a: { name: string }) => a.name === "Contour.png");
  expect(a.data).toBe(original);
  expect(a.edits.processing.mode).toBe("line-art");
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  await expect(dialog.getByLabel("Artwork conversion")).toHaveValue("line-art");
  expect(errors).toEqual([]);
});
