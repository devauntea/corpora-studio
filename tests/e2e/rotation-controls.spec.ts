import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("rotation sliders, quick turns and reset are easy to undo for models and tattoos", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("tripo-muscular-arm");
  const host = page.locator(".canvas-host");
  const body = async () =>
    JSON.parse((await host.getAttribute("data-rendered-body")) || "{}");
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptId: "tripo-muscular-arm" } });
  await page
    .getByRole("button", { name: "Rotate Y increase 15 degrees", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { y: 15 } } });
  const slider = page.getByRole("slider", {
    name: "Rotate Y slider",
    exact: true,
  });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  for (const x of [0.3, 0.4, 0.5, 0.6])
    await page.mouse.move(box.x + box.width * x, box.y + box.height / 2, {
      steps: 3,
    });
  await page.mouse.up();
  await expect
    .poll(async () => (await body()).model?.sculptRotation?.y)
    .toBeGreaterThan(180);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { y: 15 } } });
  await page
    .getByRole("button", { name: "Rotate Y reset", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { y: 0 } } });
  await page
    .getByRole("button", { name: "Lay model horizontal", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { x: 0, y: 0, z: 90 } } });
  await page
    .getByRole("button", { name: "Reset model rotation", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { z: 0 } } });
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await page
    .getByRole("button", { name: "Rotation increase 15 degrees", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Rotation", exact: true }),
  ).toHaveValue("15");
  const tattoo = page.getByRole("slider", {
    name: "Rotation slider",
    exact: true,
  });
  await tattoo.focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.up("ArrowRight");
  await expect(
    page.getByRole("spinbutton", { name: "Rotation", exact: true }),
  ).toHaveValue("16");
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Rotation", exact: true }),
  ).toHaveValue("15");
  await page
    .getByRole("button", { name: "Rotation increase 90 degrees", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("rotations.formstudio");
  await (await download).saveAs(file);
  expect(JSON.parse(await fs.readFile(file, "utf8")).layers[0].rotation).toBe(
    105,
  );
  await page.screenshot({ path: info.outputPath("tattoo-rotation.png") });
  await page
    .getByRole("button", { name: "Rotation reset", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Rotation", exact: true }),
  ).toHaveValue("0");
});
