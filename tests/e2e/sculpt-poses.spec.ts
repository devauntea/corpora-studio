import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("one muscular leg collection exposes six poses and preserves the chosen pose", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Choose body/ }).click();
  const dialog = page.getByRole("dialog", { name: "Find your canvas." });
  await page.getByLabel("Search body models").fill("muscular leg");
  const card = dialog
    .locator(".body-library-card")
    .filter({ has: page.getByText("Muscular leg", { exact: true }) });
  await expect(card).toHaveCount(1);
  await card.click();
  const pose = dialog.getByLabel("Imported leg pose");
  await expect(pose.locator("option")).toHaveCount(6);
  await pose.selectOption("tripo-leg-six");
  await expect(
    dialog.locator(".body-library-detail-preview img"),
  ).toHaveAttribute("src", "/sculpts/tripo-leg-six.png");
  await page.screenshot({ path: info.outputPath("leg-collection.png") });
  await dialog
    .getByRole("button", { name: "Use muscular leg", exact: true })
    .click();
  const host = page.locator(".canvas-host");
  const ready = (id: string) =>
    expect
      .poll(async () =>
        JSON.parse((await host.getAttribute("data-rendered-body")) || "{}"),
      )
      .toMatchObject({ model: { sculptId: id } });
  await ready("tripo-leg-six");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await expect(page.getByLabel("Imported leg pose")).toHaveValue(
    "tripo-leg-six",
  );
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("leg-pose.formstudio");
  await (await save).saveAs(file);
  expect(JSON.parse(await fs.readFile(file, "utf8")).body.model.sculptId).toBe(
    "tripo-leg-six",
  );
  await page.getByLabel("Imported leg pose").selectOption("tripo-leg-two");
  await ready("tripo-leg-two");
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await ready("tripo-leg-six");
  await page.getByLabel("Imported leg pose").selectOption("tripo-leg-one");
  await ready("tripo-leg-one");
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await ready("tripo-leg-six");
  await page.getByRole("button", { name: /Choose body/ }).click();
  await expect(dialog.getByLabel("Imported leg pose")).toHaveValue(
    "tripo-leg-six",
  );
});
