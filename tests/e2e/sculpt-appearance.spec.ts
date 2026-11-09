import { test, expect } from "@playwright/test";
import { sculptIds } from "../../src/sculpt-catalog";
import fs from "node:fs/promises";
test("all imported models support skin tones and saved complete orientation", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  const host = page.locator(".canvas-host");
  const body = async () =>
    JSON.parse((await host.getAttribute("data-rendered-body")) || "{}");
  for (const id of sculptIds.filter(
    (id) => !id.startsWith("derived-anatomy-"),
  )) {
    if (id.startsWith("tripo-leg-") && id !== "tripo-leg-one")
      await page.getByLabel("Imported leg pose").selectOption(id);
    else if (id.startsWith("derived-anatomy-") && id !== "derived-anatomy-body")
      await page.getByLabel("Imported body section").selectOption(id);
    else await page.getByLabel("Body region").selectOption(id);
    await expect.poll(body).toMatchObject({ model: { sculptId: id } });
    await page
      .getByRole("button", { name: "Skin tone #e0bfa5", exact: true })
      .click();
    await expect
      .poll(body)
      .toMatchObject({ skin: "#e0bfa5", model: { sculptAppearance: "skin" } });
    if (id.startsWith("derived-anatomy-"))
      await expect(
        page.getByRole("switch", { name: "Muscle display", exact: true }),
      ).toHaveAttribute("aria-checked", "false");
    else
      await expect(page.getByLabel("Imported surface colors")).toHaveValue(
        "skin",
      );
  }
  await page.getByLabel("Body region").selectOption("tripo-human-anatomy");
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptId: "tripo-human-anatomy" } });
  const original = await host.screenshot();
  await page
    .getByRole("button", { name: "Skin tone #e0bfa5", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptAppearance: "skin" } });
  const skin = await host.screenshot();
  expect(skin.equals(original)).toBe(false);
  await page.screenshot({ path: info.outputPath("skin-tone.png") });
  for (const axis of ["X", "Y", "Z"]) {
    const field = page.getByRole("spinbutton", {
      name: `Rotate ${axis}`,
      exact: true,
    });
    await field.fill("360");
    await field.press("Enter");
  }
  await expect
    .poll(async () =>
      JSON.parse((await host.getAttribute("data-model-rotation")) || "[]"),
    )
    .toEqual([Math.PI * 2, Math.PI * 2, Math.PI * 2]);
  const rotate = page.getByRole("spinbutton", {
    name: "Rotate Z",
    exact: true,
  });
  await rotate.fill("90");
  await rotate.press("Enter");
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { x: 360, y: 360, z: 90 } } });
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page.screenshot({ path: info.outputPath("rotated.png") });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("oriented.formstudio");
  await (await download).saveAs(file);
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  expect(saved.body.model.sculptRotation.z).toBe(90);
  await page
    .getByRole("button", { name: "Reset model rotation", exact: true })
    .click();
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptRotation: { x: 0, y: 0, z: 0 } } });
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await expect.poll(body).toMatchObject({
    model: { sculptRotation: { z: 90 }, sculptAppearance: "skin" },
  });
  await page.getByLabel("Imported surface colors").selectOption("original");
  await expect
    .poll(body)
    .toMatchObject({ model: { sculptAppearance: "original" } });
  expect(errors).toEqual([]);
});
