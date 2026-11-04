import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

test("crop preserves source masks, exports exact dimensions and updates photo proportions with grouped undo", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  const make = async (width: number, height: number, color: string) =>
    Buffer.from(
      await page.evaluate(
        ({ width, height, color }) => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, width, height);
          return c.toDataURL().split(",")[1];
        },
        { width, height, color },
      ),
      "base64",
    );
  const art = await make(320, 240, "#000000");
  await page.getByRole("button", { name: "Photograph", exact: true }).click();
  await page.getByLabel("Import body photos", { exact: true }).setInputFiles({
    name: "Body.png",
    mimeType: "image/png",
    buffer: await make(800, 600, "#c49b7d"),
  });
  await expect(page.locator(".photo-list button")).toHaveCount(1);
  await page
    .getByLabel("Artwork file", { exact: true })
    .setInputFiles({ name: "Crop.png", mimeType: "image/png", buffer: art });
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  const dialog = page.getByRole("dialog", { name: "Tattoo image studio" }),
    canvas = dialog.getByLabel("Artwork cleanup canvas");
  await expect(canvas).toHaveAttribute("width", "320");
  const fitWidth = (await canvas.boundingBox())!.width;
  await dialog.getByLabel("Image zoom", { exact: true }).selectOption("2");
  await expect
    .poll(async () => (await canvas.boundingBox())!.width)
    .toBeCloseTo(fitWidth * 2, 0);
  await dialog.getByLabel("Image zoom", { exact: true }).selectOption("1");
  const alpha = (u: number, v: number) =>
    canvas.evaluate(
      (c: HTMLCanvasElement, { u, v }) =>
        c.getContext("2d")!.getImageData(c.width * u, c.height * v, 1, 1)
          .data[3],
      { u, v },
    );
  let b = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: b.width * 0.5, y: b.height * 0.5 } });
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await dialog.getByRole("button", { name: "Crop image", exact: true }).click();
  b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.125);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.875, {
    steps: 8,
  });
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath("crop-selection.png") });
  await dialog
    .getByRole("button", { name: "Finish crop", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "160");
  await expect(canvas).toHaveAttribute("height", "180");
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await expect.poll(() => alpha(0.1, 0.1)).toBe(255);
  // One undo restores the entire crop drag; the earlier erase remains.
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "320");
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await dialog
    .getByRole("button", { name: "Redo image edit", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "160");
  // New brush strokes on the cropped preview still target original-image coordinates.
  b = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: b.width * 0.25, y: b.height * 0.25 } });
  await expect.poll(() => alpha(0.25, 0.25)).toBe(0);
  await dialog.getByRole("button", { name: "Crop image", exact: true }).click();
  await dialog.getByRole("button", { name: "Reset crop", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Finish crop", exact: true })
    .click();
  await expect.poll(() => alpha(0.375, 0.3125)).toBe(0);
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "160");
  // Extreme trim values retain a valid minimum crop and undo in one step.
  await dialog.getByRole("button", { name: "Crop image", exact: true }).click();
  await dialog.getByLabel("Left crop trim", { exact: true }).press("End");
  await dialog
    .getByRole("button", { name: "Finish crop", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "3");
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("width", "160");
  // A continuous tone adjustment is a single undo step.
  const contrast = dialog.getByLabel("Image contrast", { exact: true });
  await contrast.scrollIntoViewIfNeeded();
  const slider = (await contrast.boundingBox())!;
  await page.mouse.move(
    slider.x + slider.width * 0.4,
    slider.y + slider.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    slider.x + slider.width * 0.8,
    slider.y + slider.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(contrast).not.toHaveValue("1");
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect(contrast).toHaveValue("1");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export PNG", exact: true }).click();
  const png = info.outputPath("cropped.png");
  await (await download).saveAs(png);
  const bytes = await fs.readFile(png);
  expect(bytes.readUInt32BE(16)).toBe(160);
  expect(bytes.readUInt32BE(20)).toBe(180);
  await dialog
    .getByRole("button", { name: "Apply to artwork", exact: true })
    .click();
  const svg = page.getByLabel("Photo placement controls");
  // 25% of an 800 px photo = 200 px width; cropped height is 225 px.
  const photoCanvas = page.getByLabel("Photo composition preview");
  const pixel = (x: number, y: number) =>
    photoCanvas.evaluate(
      (c: HTMLCanvasElement, { x, y }) =>
        Array.from(c.getContext("2d")!.getImageData(x, y, 1, 1).data),
      { x, y },
    );
  await expect.poll(async () => (await pixel(310, 195))[0]).toBeLessThan(80);
  await expect.poll(() => pixel(310, 180)).toEqual([196, 155, 125, 255]);
  const polygon = svg.locator("polygon").first();
  const points = (await polygon.getAttribute("points"))!
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number));
  expect(
    Math.abs(points[3][1] - points[0][1]) /
      Math.abs(points[1][0] - points[0][0]),
  ).toBeCloseTo(180 / 160, 3);
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("crop.formstudio");
  await (await save).saveAs(file);
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  const a = project.assets.find((x: { name: string }) => x.name === "Crop.png");
  expect(project.version).toBe(7);
  expect(a.sha256).toBe(createHash("sha256").update(art).digest("hex"));
  expect(Buffer.from(a.data.split(",")[1], "base64")).toEqual(art);
  expect(a.edits.strokes).toHaveLength(2);
  expect(a.edits.crop.width).toBeCloseTo(0.5, 3);
  expect(project.layers.at(-1).photo.width).toBe(0.25);
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  await expect(canvas).toHaveAttribute("width", "160");
  await expect.poll(() => alpha(0.25, 0.25)).toBe(0);
  await page.screenshot({ path: info.outputPath("cropped-studio.png") });
  expect(errors).toEqual([]);
});
