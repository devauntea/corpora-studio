import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { sculptCatalog, sculptGroupFor } from "../../src/sculpt-catalog";

test("imported sculpt parts accept tattoos and preserve identity through save/open and undo", async ({
  page,
}, info) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  const host = page.locator(".canvas-host");
  const ready = (id: string) =>
    expect
      .poll(
        async () =>
          JSON.parse((await host.getAttribute("data-rendered-body")) || "{}"),
        { timeout: 45000 },
      )
      .toMatchObject({ model: { sculptId: id } });
  await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
  await page
    .locator(".sculpt-library summary")
    .filter({ hasText: "Imported sculpts" })
    .click();
  for (const entry of sculptCatalog.filter(
    (e) => e.groupId !== "derived-anatomy",
  )) {
    if (entry.groupId) {
      const label = entry.variantLabel
        ? "Imported body section"
        : "Imported leg pose";
      if (!(await page.getByLabel(label).count()))
        await page
          .getByLabel("Body region")
          .selectOption(sculptGroupFor(entry.id)!.id);
      await page.getByLabel(label).selectOption(entry.id);
    } else
      await page.getByRole("button", { name: entry.name, exact: true }).click();
    await ready(entry.id);
    if (entry.id === "sculpt-torso")
      await page.screenshot({
        path: `qa/body-0194/imports/${info.project.name}-library-ui.png`,
      });
    await expect(page.getByLabel("Body region")).toHaveValue(
      sculptGroupFor(entry.id)!.id,
    );
    await expect(
      page.getByRole("button", { name: "Bent 90°", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("switch", { name: "Muscle anatomy guide" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "three-quarter", exact: true })
      .click();
    await page.locator(".viewport").screenshot({
      path: `qa/body-0194/imports/${info.project.name}-${entry.id}.png`,
    });
  }
  for (const legacy of ["forearm", "calf"]) {
    await page.getByLabel("Body region").selectOption(legacy);
    if (
      !(await page
        .getByRole("button", { name: "Sculpt torso", exact: true })
        .isVisible())
    )
      await page
        .locator(".sculpt-library summary")
        .filter({ hasText: "Imported sculpts" })
        .click();
    await page
      .getByRole("button", { name: "Sculpt torso", exact: true })
      .click();
    await ready("sculpt-torso");
    const body = JSON.parse(
      (await host.getAttribute("data-rendered-body")) || "{}",
    );
    expect(body.wrist).toBeUndefined();
    expect(body.region).toBeUndefined();
    expect(body.distal).toBeUndefined();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const file = info.outputPath(`from-${legacy}.formstudio`);
    await (await download).saveAs(file);
    await page.getByLabel("Body region").selectOption("sculpt-hand");
    await ready("sculpt-hand");
    await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
    await ready("sculpt-torso");
  }
  await page.getByLabel("Body region").selectOption("sculpt-torso");
  await ready("sculpt-torso");
  await page.getByLabel("Body artwork detail").selectOption("trunk");
  await expect
    .poll(async () =>
      JSON.parse((await host.getAttribute("data-chart-sizes")) || "{}"),
    )
    .toEqual({ trunk: 4096 });
  await page
    .getByRole("spinbutton", { name: "Model height", exact: true })
    .fill("700");
  await page
    .getByRole("spinbutton", { name: "Model height", exact: true })
    .press("Enter");
  await expect
    .poll(async () =>
      JSON.parse((await host.getAttribute("data-rendered-body")) || "{}"),
    )
    .toMatchObject({ length: 700 });
  await page.getByRole("button", { name: "front", exact: true }).click();
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await page
    .getByRole("switch", { name: "Connected surface placement" })
    .click();
  await expect
    .poll(
      async () => Number(await host.getAttribute("data-connected-triangles")),
      { timeout: 45000 },
    )
    .toBeGreaterThan(20);
  await page.locator(".viewport").screenshot({
    path: `qa/body-0194/imports/${info.project.name}-tattoo-connected.png`,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("sculpt.formstudio");
  await (await download).saveAs(file);
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  expect(saved.version).toBe(19);
  expect(saved.layers[0].surface.sculptId).toBe("sculpt-torso");
  expect(saved.body.armPose).toBeUndefined();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("sculpt-hand");
  await ready("sculpt-hand");
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await ready("sculpt-torso");
  await expect
    .poll(
      async () => Number(await host.getAttribute("data-connected-triangles")),
      { timeout: 45000 },
    )
    .toBeGreaterThan(20);
  await page.getByLabel("Body region").selectOption("full-arm");
  await expect(
    page.getByRole("button", { name: "Bent 90°", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await ready("sculpt-torso");
  await expect
    .poll(
      async () => Number(await host.getAttribute("data-connected-triangles")),
      { timeout: 45000 },
    )
    .toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
