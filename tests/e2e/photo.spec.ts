import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

test("photo composition: transforms, protection, undo, locking, export and portable original bytes", async ({
  page,
}, info) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:1420")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  const make = async (color: string) =>
    Buffer.from(
      await page.evaluate((color) => {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 600;
        const x = c.getContext("2d")!;
        x.fillStyle = color;
        x.fillRect(0, 0, 800, 600);
        return c.toDataURL().split(",")[1];
      }, color),
      "base64",
    );
  const body = await make("#c49b7d"),
    art = await make("#202020");
  await page.getByRole("button", { name: "Photograph", exact: true }).click();
  await expect(page.locator(".layer-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Make your first mark." }),
  ).toBeVisible();
  await page.getByLabel("Import body photos", { exact: true }).setInputFiles([
    { name: "Body.png", mimeType: "image/png", buffer: body },
    { name: "Angle.png", mimeType: "image/png", buffer: body },
  ]);
  await expect(page.locator(".photo-list button")).toHaveCount(2);
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles({
    name: "Black shape.png",
    mimeType: "image/png",
    buffer: art,
  });
  await expect(
    page.getByRole("heading", { name: "Black shape", exact: true }),
  ).toBeVisible();
  const canvas = page.getByLabel("Photo composition preview"),
    svg = page.getByLabel("Photo placement controls");
  const pixel = () =>
    canvas.evaluate((c: HTMLCanvasElement) =>
      Array.from(
        c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1).data,
      ),
    );
  await expect.poll(async () => (await pixel())[0]).toBeLessThan(130);
  // Artwork moves, with one undo restoring the complete gesture.
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.57, box.y + box.height * 0.54, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByLabel("Photo X", { exact: true })).not.toHaveValue(
    "50",
  );
  await page.getByLabel("Undo (⌘Z)", { exact: true }).click();
  await expect(page.getByLabel("Photo X", { exact: true })).toHaveValue("50");
  const handle = svg.locator("[data-action=scale]").nth(2),
    h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 50, h.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Photo width", { exact: true })).not.toHaveValue(
    "25",
  );
  await page.getByLabel("Undo (⌘Z)", { exact: true }).click();
  await expect(page.getByLabel("Photo width", { exact: true })).toHaveValue(
    "25",
  );
  await page
    .getByRole("button", { name: "Protect existing ink", exact: true })
    .click();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.49);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.51, {
    steps: 4,
  });
  await page.mouse.up();
  await expect.poll(pixel).toEqual([196, 155, 125, 255]);
  await page.getByLabel("Undo (⌘Z)", { exact: true }).click();
  await expect.poll(async () => (await pixel())[0]).toBeLessThan(130);
  await page.getByLabel("Redo (⇧⌘Z)", { exact: true }).click();
  await expect.poll(pixel).toEqual([196, 155, 125, 255]);
  await page.getByRole("button", { name: "Transform", exact: true }).click();
  await svg.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Photo X", { exact: true })).toHaveValue("50.1");
  await page.getByRole("switch", { name: "Lock layer", exact: true }).click();
  await expect(page.getByLabel("Photo X", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Ink preview", { exact: true })).toBeDisabled();
  await svg.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Photo X", { exact: true })).toHaveValue("50.1");
  await page.getByRole("switch", { name: "Lock layer", exact: true }).click();
  await page.getByLabel("Shear warp", { exact: true }).fill("25");
  await page.getByLabel("Shear warp", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Flip horizontal", exact: true })
    .click();
  await page.getByLabel("Ink preview", { exact: true }).selectOption("custom");
  await page.getByLabel("Custom ink color", { exact: true }).fill("#164832");
  await page
    .getByRole("button", { name: "Show original", exact: true })
    .click();
  await expect.poll(pixel).toEqual([196, 155, 125, 255]);
  await page
    .getByRole("button", { name: "Show composition", exact: true })
    .click();
  await page.getByRole("button", { name: "Warp corners", exact: true }).click();
  const warpHandle = svg.locator('[data-action="warp-0"]'),
    wb = (await warpHandle.boundingBox())!;
  const polygon = svg.locator("polygon"),
    oldPoints = await polygon.getAttribute("points");
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
  await page.mouse.down();
  await page.mouse.move(wb.x + wb.width / 2 + 22, wb.y + wb.height / 2 + 13, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(polygon).not.toHaveAttribute("points", oldPoints!);
  await expect.poll(pixel).toEqual([196, 155, 125, 255]);
  const warpedPoints = await polygon.getAttribute("points");
  await page.getByLabel("Undo (⌘Z)", { exact: true }).click();
  await expect(polygon).toHaveAttribute("points", oldPoints!);
  await page.getByLabel("Redo (⇧⌘Z)", { exact: true }).click();
  await expect(polygon).toHaveAttribute("points", warpedPoints!);
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const download = await save,
    file = info.outputPath("photo.formstudio");
  await download.saveAs(file);
  const p = JSON.parse(await fs.readFile(file, "utf8"));
  expect(p.version).toBe(8);
  expect(p.photos).toHaveLength(2);
  expect(p.photos[0].masks).toHaveLength(1);
  expect(p.layers.at(-1).flipX).toBe(true);
  expect(p.layers.at(-1).photo.warp).toHaveLength(4);
  const original = p.assets.find((a: { role: string }) => a.role === "body");
  expect(Buffer.from(original.data.split(",")[1], "base64")).toEqual(body);
  expect(original.sha256).toBe(createHash("sha256").update(body).digest("hex"));
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await expect(page.getByLabel("Shear warp", { exact: true })).toHaveValue(
    "25",
  );
  const review = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export review", exact: true })
    .click();
  await (await review).saveAs(info.outputPath("photo-review.png"));
  const png = await fs.readFile(info.outputPath("photo-review.png"));
  expect(png.readUInt32BE(16)).toBe(800);
  expect(png.readUInt32BE(20)).toBe(700);
  await page.screenshot({ path: info.outputPath("photo-workspace.png") });
  await page.getByRole("button", { name: "3D surface", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region", { exact: true }).selectOption("torso");
  await expect(
    page.getByLabel("Waist circumference", { exact: true }),
  ).toHaveValue("850");
  await page.getByLabel("Muscle contour", { exact: true }).fill("85");
  await page.getByLabel("Muscle contour", { exact: true }).press("Enter");
  await page.screenshot({ path: info.outputPath("torso-workspace.png") });
  await page.getByRole("button", { name: "Photograph", exact: true }).click();
  await page.getByRole("button", { name: "Angle.png", exact: true }).click();
  await page
    .getByLabel("Add Black shape.png from library", { exact: true })
    .click();
  await page.getByRole("button", { name: "Body.png", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByLabel("Move layer backward", { exact: true }).click();
  const reordered = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const orderFile = info.outputPath("ordered.formstudio");
  await (await reordered).saveAs(orderFile);
  const ordered = JSON.parse(await fs.readFile(orderFile, "utf8"));
  expect(
    ordered.layers
      .filter((l: { photoId?: string }) => l.photoId === ordered.photos[0].id)
      .map((l: { name: string }) => l.name),
  ).toEqual(["Black shape copy", "Black shape"]);
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles({
    name: "Broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
