import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("detailed body library, registered muscle filter and saved choices", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
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
  await page.getByLabel("Body region").selectOption("upper-body");
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .locator(".canvas-host")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ section: "upper-body" });
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  const canvas = page.locator(".canvas-host canvas").first();
  const beforeZoom = await canvas.screenshot();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => beforeZoom.equals(await canvas.screenshot()))
    .toBe(false);
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page
    .getByRole("button", { name: "Skin tone #e0bfa5", exact: true })
    .click();
  const ready = async (values: Record<string, unknown>) => {
    await expect
      .poll(async () =>
        JSON.parse(
          (await page
            .locator(".canvas-host")
            .getAttribute("data-rendered-body")) || "{}",
        ),
      )
      .toMatchObject(values);
  };
  for (const sex of ["male", "female"]) {
    await page
      .getByRole("button", {
        name: sex === "male" ? "Male" : "Female",
        exact: true,
      })
      .click();
    for (const physique of ["fit", "average"]) {
      await page
        .getByRole("button", {
          name: physique === "fit" ? "Fit" : "Average",
          exact: true,
        })
        .click();
      await ready({
        section: "upper-body",
        model: { sex, physique },
        muscularity: physique === "fit" ? 1 : 0,
      });
      for (const view of ["Front", "Back", "Left"]) {
        await page
          .getByRole("button", { name: view.toLowerCase(), exact: true })
          .click();
        await page.locator(".viewport").screenshot({
          path: info.outputPath(`${sex}-${physique}-${view.toLowerCase()}.png`),
        });
      }
    }
  }
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("switch", { name: "Muscle anatomy guide" }).click();
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .press("Enter");
  await ready({
    anatomy: true,
    model: { sex: "male", physique: "fit", anatomyOpacity: 1 },
  });
  await expect(page.locator(".muscle-legend")).toContainText(
    "Serratus anterior",
  );
  for (const view of ["Front", "Back", "Left"]) {
    await page
      .getByRole("button", { name: view.toLowerCase(), exact: true })
      .click();
    await page.locator(".viewport").screenshot({
      path: info.outputPath(`anatomy-${view.toLowerCase()}.png`),
    });
  }
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Body region").selectOption("full-arm");
  await ready({ section: "full-arm" });
  await page.getByRole("switch", { name: "Muscle anatomy guide" }).click();
  await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
  await ready({ armPose: { left: { flex: 90 } } });
  await page.getByRole("button", { name: "front", exact: true }).click();
  await page
    .locator(".viewport")
    .screenshot({ path: info.outputPath("anatomy-bent.png") });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("detailed.formstudio");
  await (await downloading).saveAs(file);
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  expect(saved.version).toBe(19);
  expect(saved.body.model).toEqual({
    revision: 9,
    sex: "male",
    physique: "fit",
    anatomyOpacity: 1,
  });
  await page.getByRole("button", { name: "Female", exact: true }).click();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await ready(saved.body);
  await expect(
    page.getByRole("switch", { name: "Muscle anatomy guide" }),
  ).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});
