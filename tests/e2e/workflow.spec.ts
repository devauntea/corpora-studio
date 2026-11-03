import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("editing, local round trip, invalid-file recovery, import and review export", async ({
  page,
}, testInfo) => {
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
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("forearm");
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  const width = page.getByRole("spinbutton", { name: "Width", exact: true });
  await width.fill("77");
  await width.press("Escape");
  await expect(width).toHaveValue("95");
  await width.fill("120");
  await width.press("Enter");
  await expect(width).toHaveValue("120");
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(width).toHaveValue("95");
  await page.getByRole("button", { name: "Redo (⇧⌘Z)", exact: true }).click();
  await expect(width).toHaveValue("120");
  await page
    .getByRole("spinbutton", { name: "Rotation", exact: true })
    .fill("31");
  await page
    .getByRole("spinbutton", { name: "Rotation", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Forearm length" }).fill("310");
  await page.getByRole("spinbutton", { name: "Forearm length" }).press("Enter");
  await page
    .getByRole("button", { name: "Right forearm", exact: true })
    .click();
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const download = await saved,
    file = testInfo.outputPath("roundtrip.formstudio");
  await download.saveAs(file);
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));
  expect(manifest.body.length).toBe(310);
  expect(manifest.body.side).toBe("right");
  expect(manifest.layers[0].width).toBe(120);
  expect(manifest.layers[0].rotation).toBe(31);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Untitled composition",
  );
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Solar study",
  );
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await expect(width).toHaveValue("120");
  await page.getByLabel("Project file", { exact: true }).setInputFiles({
    name: "corrupt.formstudio",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported or damaged");
  await expect(width).toHaveValue("120");
  await page.getByLabel("Dismiss notification").click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 200, 300);
    ctx.fillStyle = "black";
    ctx.fillRect(40, 40, 120, 220);
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles({
    name: "Placement test.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(
    page.getByRole("heading", { name: "Placement test" }),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: "Around arm" }).fill("179");
  await page.getByRole("spinbutton", { name: "Around arm" }).press("Enter");
  await page.getByRole("button", { name: "back", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("seam-back.png") });
  const review = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export review" }).click();
  const reviewDownload = await review;
  await reviewDownload.saveAs(testInfo.outputPath("review.png"));
  const bytes = await fs.readFile(testInfo.outputPath("review.png"));
  expect(bytes.readUInt32BE(16)).toBe(1800);
  expect(bytes.readUInt32BE(20)).toBe(1800);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Placement test" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("surface dragging groups history and a full orbit stays interactive", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("forearm");
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await page
    .getByRole("button", { name: "Place artwork (G)", exact: true })
    .click();
  const canvas = page.locator(".canvas-host canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 15,
    box.y + box.height / 2 - 50,
    { steps: 12 },
  );
  await page.mouse.up();
  const changed = await page
    .getByRole("spinbutton", { name: "From wrist" })
    .inputValue();
  expect(Number(changed)).not.toBe(135);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "From wrist" }),
  ).toHaveValue("135");
  await page.getByRole("button", { name: "Orbit view (V)" }).click();
  for (const name of ["front", "left", "back", "right", "front"])
    await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("button", { name: "Toggle rendering diagnostics" })
    .count();
  await page.locator(".statusbar button").click();
  await expect(page.locator(".statusbar")).toContainText("p95");
  await page.screenshot({ path: testInfo.outputPath("workspace.png") });
  console.log(
    testInfo.project.name,
    await page.locator(".statusbar").innerText(),
  );
});
