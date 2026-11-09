import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

test("fabric edits persist in projects and manufacturer SVG/PDF packs", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open fabric and color workspace",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Fabric and color studio" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fabric pattern Plaid", exact: true })
    .click();
  await page
    .getByLabel("Fabric application target", { exact: true })
    .selectOption("both");
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await page.getByLabel("Fabric base color", { exact: true }).fill("#b43c75");
  await page.getByRole("button", { name: "Repeat", exact: true }).click();
  await page.getByLabel("Fabric repeat size", { exact: true }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 21; i++) await page.keyboard.press("ArrowRight");
  await page
    .getByRole("button", { name: "Fabric rotation 90 degrees", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply fabric & color", exact: true })
    .click();
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const projectPath = info.outputPath("textile.formstudio");
  await (await save).saveAs(projectPath);
  const project = JSON.parse(await fs.readFile(projectPath, "utf8"));
  const printed = project.fashion.vectorPack.layers.filter(
    (l: any) => l.textile,
  );
  expect(printed).toHaveLength(2);
  expect(printed[0].textile).toMatchObject({
    pattern: "plaid",
    scale: 54,
    rotation: 90,
    colors: [
      "#b43c75",
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ],
  });
  await page
    .getByRole("button", { name: "Technical flats", exact: true })
    .click();
  const paths = page.locator('.vector-canvas path[fill^="url(#textile-"]');
  await expect(paths).toHaveCount(2);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  await expect(paths).toHaveCount(0);
  await page
    .getByRole("button", { name: "Redo vector edit", exact: true })
    .click();
  await expect(paths).toHaveCount(2);
  await page.reload();
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(projectPath);
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", { name: "Open vector workspace", exact: true })
    .click();
  await expect(paths).toHaveCount(2);
  const exporting = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export reviewed ZIP", exact: true })
    .click();
  const zipPath = info.outputPath("textiles.zip");
  await (await exporting).saveAs(zipPath);
  const files = unzipSync(new Uint8Array(await fs.readFile(zipPath)));
  expect(strFromU8(files["textiles.csv"])).toContain("#b43c75");
  expect(strFromU8(files["front.svg"])).toContain("<pattern");
  expect(strFromU8(files["front.svg"])).toContain("rotate(90)");
  expect(strFromU8(files["tech-pack.pdf"])).toContain("/PatternType 1");
  const restored = JSON.parse(strFromU8(files["editable-vector-pack.json"]));
  expect(restored).toEqual(project.fashion.vectorPack);
  expect(
    Object.keys(files).filter((n) => n.startsWith("textiles/")),
  ).toHaveLength(2);
  expect(errors).toEqual([]);
});
