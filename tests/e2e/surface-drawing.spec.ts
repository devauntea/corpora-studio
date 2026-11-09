import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("draw, erase, undo, save and flex surface ink; navigate in editing modes", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("upper-body");
  const host = page.locator(".canvas-host"),
    canvas = host.locator("canvas");
  const body = async () =>
    JSON.parse((await host.getAttribute("data-rendered-body")) || "{}");
  await expect.poll(body).toMatchObject({ section: "upper-body" });
  const camera = async () =>
    JSON.parse((await host.getAttribute("data-camera")) || "{}");
  const distance = async () => {
    const c = await camera();
    return Math.hypot(
      ...c.position.map((v: number, i: number) => v - c.target[i]),
    );
  };
  await page
    .getByRole("button", { name: "Place artwork (G)", exact: true })
    .click();
  await canvas.hover();
  const beforeZoom = await distance();
  await page.mouse.wheel(0, -400);
  await expect.poll(distance).toBeLessThan(beforeZoom * 0.98);
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page.getByRole("button", { name: "Pan view (H)", exact: true }).click();
  const bounds = (await canvas.boundingBox())!;
  const x = bounds.x + bounds.width * 0.5,
    y = bounds.y + bounds.height * 0.5;
  const beforePan = (await camera()).target;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 30, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await camera()).target).not.toEqual(beforePan);
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page
    .getByRole("button", { name: "Orbit view (V)", exact: true })
    .click();
  const beforeFocus = await distance();
  await page.mouse.dblclick(x, y);
  await expect.poll(distance).toBeLessThan(beforeFocus);
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page
    .getByRole("button", { name: "Draw on model (B)", exact: true })
    .click();
  await page.getByLabel("Drawing ink color").fill("#a32222");
  await page.mouse.move(x - 30, y + 20);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 60, { steps: 24 });
  await page.mouse.up();
  await expect(
    page.getByRole("heading", { name: "Drawn ink · trunk", exact: true }),
  ).toBeVisible();
  const save = async (name: string) => {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const path = info.outputPath(name + ".formstudio");
    await (await event).saveAs(path);
    return { path, data: JSON.parse(await fs.readFile(path, "utf8")) };
  };
  const drawn = await save("drawn");
  const asset = drawn.data.assets.find(
    (a: any) => a.name === "Drawn ink · trunk",
  );
  expect(asset).toBeTruthy();
  await page.screenshot({ path: info.outputPath("direct-drawing.png") });
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.mouse.move(x, y + 40);
  await page.mouse.down();
  await page.mouse.move(x + 15, y + 50, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const erased = await save("erased");
  expect(
    erased.data.assets.find((a: any) => a.id === asset.id).sha256,
  ).not.toBe(asset.sha256);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  const undone = await save("undo");
  expect(undone.data.assets.find((a: any) => a.id === asset.id).sha256).toBe(
    asset.sha256,
  );
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page
    .getByLabel("Muscle pose", { exact: true })
    .selectOption("chest-flex");
  await expect.poll(body).toMatchObject({ musclePose: "chest-flex" });
  const flexed = await save("flexed");
  expect(flexed.data.assets).toEqual(undone.data.assets);
  expect(flexed.data.layers).toEqual(undone.data.layers);
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(drawn.path);
  await expect.poll(body).toEqual(drawn.data.body);
  await page.reload();
  drawn.data.layers.find((l: any) => l.surfaceDrawing).name =
    "Custom brushwork";
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles({
      name: "drawing.formstudio",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(drawn.data)),
    });
  await expect.poll(body).toEqual(drawn.data.body);
  await page
    .getByRole("button", { name: "Draw on model (B)", exact: true })
    .click();
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.mouse.move(x, y + 40);
  await page.mouse.down();
  await page.mouse.move(x + 15, y + 50, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const reopened = await save("reopened-erased");
  expect(reopened.data.layers).toHaveLength(drawn.data.layers.length);
  expect(
    reopened.data.assets.find((a: any) => a.id === asset.id).sha256,
  ).not.toBe(asset.sha256);
  await page.getByRole("button", { name: /Choose body/ }).click();
  await page.getByLabel("Search body models").fill("Anatomy-derived");
  await expect(page.locator(".body-library-card")).toHaveCount(0);
  expect(errors).toEqual([]);
});
