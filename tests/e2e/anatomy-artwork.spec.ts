import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

test("whole sections, chart selection, muscle guide and posed project round trip", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await expect(page.getByLabel("Body region")).toHaveValue("full-arm");
  await page.getByLabel("Body region").selectOption("full-body");
  await page.getByRole("switch", { name: "Muscle anatomy guide" }).click();
  await expect(page.locator(".muscle-legend")).toContainText(
    "Pectoralis major",
  );
  await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex" }),
  ).toHaveValue("90");
  for (const [name, value] of [
    ["Shoulder elevation", "65"],
    ["Forearm rotation", "-45"],
  ]) {
    await page.getByRole("spinbutton", { name }).fill(value);
    await page.getByRole("spinbutton", { name }).press("Enter");
  }
  await page
    .getByRole("button", { name: "Pose right arm", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex" }),
  ).toHaveValue("0");
  for (const [name, value] of [
    ["Elbow flex", "25"],
    ["Shoulder elevation", "30"],
    ["Forearm rotation", "60"],
  ]) {
    await page.getByRole("spinbutton", { name }).fill(value);
    await page.getByRole("spinbutton", { name }).press("Enter");
  }
  await page
    .getByRole("button", { name: "Pose left arm", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex" }),
  ).toHaveValue("90");
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page.screenshot({ path: info.outputPath("independent-arm-poses.png") });
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await page.getByLabel("Placement surface").selectOption("right-arm");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("posed.formstudio");
  await (await download).saveAs(file);
  const p = JSON.parse(await fs.readFile(file, "utf8"));
  expect(p.version).toBe(19);
  expect(p.body).toMatchObject({
    kind: "human-v1",
    section: "full-body",
    flex: 0,
    armPose: {
      left: { flex: 90, raise: 65, twist: -45 },
      right: { flex: 25, raise: 30, twist: 60 },
    },
    anatomy: true,
  });
  expect(p.layers[0].zone).toBe("right-arm");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("full-leg");
  await expect(
    page.getByRole("spinbutton", { name: "Knee flex" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "right", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
  await page.screenshot({ path: info.outputPath("bent-leg.png") });
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  // A loaded project restores its body, pose, map and placement chart.
  await expect(page.getByLabel("Body region")).toHaveValue("full-body");
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex" }),
  ).toHaveValue("90");
  await expect(
    page.getByRole("spinbutton", { name: "Shoulder elevation" }),
  ).toHaveValue("65");
  await expect(
    page.getByRole("spinbutton", { name: "Forearm rotation" }),
  ).toHaveValue("-45");
  await expect(
    page.getByRole("switch", { name: "Muscle anatomy guide" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "right", exact: true }).last().click();
  await page.screenshot({ path: info.outputPath("posed-anatomy.png") });
  const review = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export review", exact: true })
    .click();
  await (await review).saveAs(info.outputPath("posed-review.png"));
  expect(errors).toEqual([]);
});

test("image studio background removal, erase/restore, undo, transparent export and unchanged original", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  const original = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const x = c.getContext("2d")!;
      x.fillStyle = "white";
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = "black";
      x.fillRect(64, 64, 128, 128);
      x.fillStyle = "red";
      x.fillRect(20, 80, 20, 80);
      return c.toDataURL().split(",")[1];
    }),
    "base64",
  );
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles({
    name: "Cleanup.png",
    mimeType: "image/png",
    buffer: original,
  });
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  const dialog = page.getByRole("dialog", { name: "Tattoo image studio" }),
    canvas = dialog.getByLabel("Artwork cleanup canvas");
  await expect(canvas).toBeVisible();
  const alpha = (x: number, y: number) =>
    canvas.evaluate(
      (c: HTMLCanvasElement, { x, y }) =>
        c.getContext("2d")!.getImageData(c.width * x, c.height * y, 1, 1)
          .data[3],
      { x, y },
    );
  await expect.poll(() => alpha(0.05, 0.05)).toBe(255);
  await dialog
    .getByLabel("Background removal", { exact: true })
    .selectOption("white");
  await expect.poll(() => alpha(0.05, 0.05)).toBe(0);
  await expect.poll(() => alpha(0.5, 0.5)).toBe(255);
  await expect.poll(() => alpha(0.12, 0.5)).toBe(255);
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.52, b.y + b.height * 0.5, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect.poll(() => alpha(0.5, 0.5)).toBe(255);
  await dialog
    .getByRole("button", { name: "Redo image edit", exact: true })
    .click();
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await dialog.getByRole("button", { name: "Restore", exact: true }).click();
  await canvas.click({ position: { x: b.width * 0.5, y: b.height * 0.5 } });
  await expect.poll(() => alpha(0.5, 0.5)).toBe(255);
  await dialog
    .getByRole("button", { name: "Undo image edit", exact: true })
    .click();
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  await dialog
    .getByRole("button", { name: "Compare original", exact: true })
    .click();
  await expect.poll(() => alpha(0.05, 0.05)).toBe(255);
  await expect.poll(() => alpha(0.5, 0.5)).toBe(255);
  await dialog
    .getByRole("button", { name: "Show edited", exact: true })
    .click();
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  const png = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export PNG", exact: true }).click();
  const pngPath = info.outputPath("cleaned.png");
  await (await png).saveAs(pngPath);
  const bytes = await fs.readFile(pngPath);
  expect(bytes.readUInt32BE(16)).toBe(256);
  expect(bytes.readUInt32BE(20)).toBe(256);
  const pngAlpha = await page.evaluate(
    async (data) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return [
        x.getImageData(10, 10, 1, 1).data[3],
        x.getImageData(128, 128, 1, 1).data[3],
        x.getImageData(80, 80, 1, 1).data[3],
      ];
    },
    `data:image/png;base64,${bytes.toString("base64")}`,
  );
  expect(pngAlpha).toEqual([0, 0, 255]);
  await page.screenshot({ path: info.outputPath("image-studio.png") });
  await dialog
    .getByRole("button", { name: "Apply to artwork", exact: true })
    .click();
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("cleanup.formstudio");
  await (await save).saveAs(file);
  const p = JSON.parse(await fs.readFile(file, "utf8")),
    a = p.assets.find((a: { name: string }) => a.name === "Cleanup.png");
  expect(Buffer.from(a.data.split(",")[1], "base64")).toEqual(original);
  expect(a.sha256).toBe(createHash("sha256").update(original).digest("hex"));
  expect(a.edits.background).toBe("white");
  expect(a.edits.strokes).toHaveLength(1);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  await expect(
    dialog.getByLabel("Background removal", { exact: true }),
  ).toHaveValue("none");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Edit source in image studio", exact: false })
    .click();
  await expect(
    dialog.getByLabel("Background removal", { exact: true }),
  ).toHaveValue("white");
  await expect.poll(() => alpha(0.5, 0.5)).toBe(0);
  expect(errors).toEqual([]);
});
