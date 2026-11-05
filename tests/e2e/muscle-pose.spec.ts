import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("torso-only flex and full-body double biceps preserve tattoo anchors and saved pose", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("upper-body");
  const ready = async (value: Record<string, unknown>) =>
    expect
      .poll(async () =>
        JSON.parse(
          (await page
            .locator(".canvas-host")
            .getAttribute("data-rendered-body")) || "{}",
        ),
      )
      .toMatchObject(value);
  await ready({ section: "upper-body", model: { revision: 5 } });
  await expect(
    page.getByRole("spinbutton", { name: "Elbow flex", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await expect(
    page.getByLabel("Placement surface").locator("option"),
  ).toHaveCount(2);
  await page.getByLabel("Placement surface").selectOption("trunk");
  await page
    .getByRole("switch", { name: "Connected surface placement" })
    .click();
  const triangles = async () =>
    Number(
      await page
        .locator(".canvas-host")
        .getAttribute("data-connected-triangles"),
    );
  await expect.poll(triangles).toBeGreaterThan(20);
  const save = async (name: string) => {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const path = info.outputPath(name);
    await (await event).saveAs(path);
    return { path, project: JSON.parse(await fs.readFile(path, "utf8")) };
  };
  const original = await save("relaxed.formstudio");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  const relaxed = await page.locator(".canvas-host").screenshot();
  await page
    .getByLabel("Muscle pose", { exact: true })
    .selectOption("chest-flex");
  await page
    .getByRole("spinbutton", { name: "Muscle tension", exact: true })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "Muscle tension", exact: true })
    .press("Enter");
  await ready({ musclePose: "chest-flex", muscleTension: 1 });
  const chest = await page
    .locator(".canvas-host")
    .screenshot({ path: info.outputPath("chest-flex.png") });
  expect(relaxed.equals(chest)).toBe(false);
  await expect.poll(triangles).toBeGreaterThan(20);
  await page
    .getByLabel("Muscle pose", { exact: true })
    .selectOption("back-flex");
  await ready({ musclePose: "back-flex" });
  await page
    .locator(".camera-tabs")
    .getByRole("button", { name: "back", exact: true })
    .click();
  await page
    .locator(".canvas-host")
    .screenshot({ path: info.outputPath("back-flex.png") });
  const flexed = await save("flexed.formstudio");
  expect(flexed.project.layers).toEqual(original.project.layers);
  expect(flexed.project.assets).toEqual(original.project.assets);
  await page.getByLabel("Muscle pose", { exact: true }).selectOption("relaxed");
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(flexed.path);
  await ready({ musclePose: "back-flex", muscleTension: 1 });
  await expect(page.getByLabel("Muscle pose", { exact: true })).toHaveValue(
    "back-flex",
  );
  await page.getByLabel("Body region").selectOption("full-body");
  await ready({ section: "full-body" });
  await page
    .getByLabel("Muscle pose", { exact: true })
    .selectOption("double-biceps");
  await ready({
    musclePose: "double-biceps",
    armPose: {
      left: { flex: 105, raise: 78 },
      right: { flex: 105, raise: 78 },
    },
  });
  await page.getByRole("button", { name: "Muscles", exact: true }).click();
  await ready({ anatomy: true });
  await page
    .locator(".camera-tabs")
    .getByRole("button", { name: "back", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit model", exact: true }).click();
  await page
    .locator(".canvas-host")
    .screenshot({ path: info.outputPath("double-biceps.png") });
  const posed = await save("double-biceps.formstudio");
  await page.getByLabel("Muscle pose", { exact: true }).selectOption("relaxed");
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(posed.path);
  await ready(posed.project.body);
  expect(errors).toEqual([]);
});
