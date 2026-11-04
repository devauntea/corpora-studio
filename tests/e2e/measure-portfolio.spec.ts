import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("keyboard photo measurement, formulas, checkpoint comparison and private portfolio bundle", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: "Measure garment photo" }).click();
  const d = page.getByRole("dialog", { name: "Photo garment measurements" });
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 600;
    const x = c.getContext("2d")!;
    x.fillStyle = "#eee";
    x.fillRect(0, 0, 600, 600);
    x.fillStyle = "#333";
    x.fillRect(120, 240, 300, 120);
    return c.toDataURL();
  });
  await d
    .locator("input[type=file]")
    .setInputFiles({
      name: "private-garment-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
  await d.getByLabel("Reference width (mm)", { exact: true }).fill("100");
  await d.getByLabel("Reference height (mm)", { exact: true }).fill("100");
  await d.getByText("Keyboard point placement", { exact: true }).click();
  for (const [x, y] of [
    [10, 10],
    [20, 10],
    [20, 20],
    [10, 20],
    [20, 40],
    [70, 40],
  ]) {
    await d.getByLabel("New photo point X percent").fill(String(x));
    await d.getByLabel("New photo point Y percent").fill(String(y));
    await d.getByRole("button", { name: "Place entered point" }).click();
  }
  await expect(d.getByText("500.0 mm", { exact: true })).toBeVisible();
  await d.getByLabel("Measurement 1 target").selectOption("chest");
  await d.getByLabel("Measurement 1 multiplier").fill("2");
  await d.getByLabel("Measurement 1 ease").fill("40");
  await d.getByRole("checkbox", { name: "I accounted for ease" }).check();
  await d.getByRole("button", { name: "Apply selected draft inputs" }).click();
  await expect(d.getByText(/1 draft inputs updated/)).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .include(".garment-photo")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await d.getByRole("button", { name: "Close garment photo" }).click();
  await expect(
    page.getByRole("button", { name: "Measure garment photo" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByRole("button", { name: "Add custom pattern piece" }).click();
  await page.getByText("Measurement formulas", { exact: true }).click();
  await page.getByLabel("Formula target").selectOption("1:to:x");
  await page.getByLabel("Point formula").fill("chest / 4");
  await page.getByRole("button", { name: "Apply point formula" }).click();
  await expect(
    page.getByText("p1 to.x = chest / 4", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open project library", exact: true })
    .click();
  const library = page.getByRole("dialog", {
    name: "Project library",
    exact: true,
  });
  await library.getByLabel("Checkpoint name").fill("Measured pattern");
  await library.getByRole("button", { name: "Keep checkpoint" }).click();
  await library
    .getByRole("button", { name: "Compare with current" })
    .first()
    .click();
  const compare = page.getByRole("dialog", { name: "Compare checkpoints" });
  await expect(compare.locator("img")).toHaveCount(2, { timeout: 30000 });
  await compare.getByRole("checkbox", { name: "Swipe comparison" }).check();
  await compare.getByRole("slider", { name: "Comparison split" }).fill("37");
  await expect(compare.locator("img").first()).toBeVisible();
  await compare.getByRole("button", { name: "Close comparison" }).click();
  await library.getByRole("button", { name: "Close project library" }).click();
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  const portfolio = page.getByRole("dialog", { name: "Export portfolio" });
  await portfolio
    .getByLabel("Portfolio title")
    .fill("Studies in shape & surface.");
  await portfolio
    .getByLabel("Portfolio description")
    .fill(
      "Demonstration studies made in Form Studio: original botanical artwork on body surfaces, alongside a measurement-driven garment draft.",
    );
  expect(
    await portfolio
      .getByRole("checkbox", { name: "Include body photograph mockups" })
      .isChecked(),
  ).toBe(false);
  const download = page.waitForEvent("download", { timeout: 90000 });
  await portfolio.getByRole("button", { name: "Export portfolio ZIP" }).click();
  const path = info.outputPath("portfolio.zip");
  await (await download).saveAs(path);
  const bytes = await fs.readFile(path),
    files = unzipSync(bytes),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.works).toHaveLength(5);
  expect(
    Object.keys(files).some(
      (n) => n.includes("private") || n.endsWith(".formstudio"),
    ),
  ).toBe(false);
  expect(
    manifest.works.filter(
      (w: { category: string }) => w.category === "fashion",
    ),
  ).toHaveLength(1);
  await expect(portfolio.locator(".portfolio-grid img")).toHaveCount(5);
  await page.screenshot({
    path: `qa/next-features/portfolio-${info.project.name}.png`,
  });
  const a11y = await new AxeBuilder({ page })
    .include(".stencil-studio")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  if (info.project.name === "chromium")
    await fs.writeFile("qa/next-features/demo-portfolio.zip", bytes);
  expect(errors).toEqual([]);
});
