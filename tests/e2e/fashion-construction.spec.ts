import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
async function fashion(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Teagan", exact: true }),
  ).toBeVisible();
}
const seams = (page: Page) =>
  page.getByRole("button", { name: "Seams & construction →", exact: true });
test("paired seams, assembly, design recovery and construction package persist through reopen", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fashion(page);
  await seams(page).click();
  const modal = page.getByRole("dialog", {
    name: "Make every seam intentional.",
  });
  await modal
    .getByRole("button", { name: "Load design checklist", exact: true })
    .click();
  await expect(modal.getByText("3 paired seams · 0 findings")).toBeVisible();
  const ease = modal.getByRole("spinbutton", {
    name: "Intended B minus A",
    exact: true,
  });
  await ease.fill("15");
  await ease.press("Enter");
  await expect(modal.getByText(/nonzero intended ease/)).toBeVisible();
  const seamTab = modal.getByRole("button", {
    name: "Seam relationships",
    exact: true,
  });
  await seamTab.focus();
  await seamTab.press("ControlOrMeta+z");
  await expect(ease).toHaveValue("0");
  await seamTab.press("ControlOrMeta+Shift+z");
  await expect(ease).toHaveValue("15");
  await modal.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(ease).toHaveValue("0");
  await modal
    .getByRole("button", { name: "Add matching mark at cursor", exact: true })
    .click();
  await expect(
    modal.getByRole("textbox", { name: "Mark 2 name", exact: true }),
  ).toHaveValue("Mark 2");
  const mark = modal.getByRole("spinbutton", { name: "Mark 2 A", exact: true });
  await mark.fill("999");
  await mark.press("Enter");
  await expect(modal.getByText(/outside/)).toBeVisible();
  await modal.getByRole("button", { name: "Undo", exact: true }).click();
  await modal
    .getByRole("button", { name: "Remove mark 2", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".fashion-development-dialog")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/fashion-015/seams-${info.project.name}.png`,
  });
  await modal
    .getByRole("button", { name: "Assembly steps", exact: true })
    .click();
  const instruction = modal.getByRole("textbox", {
    name: "Step 1 instructions",
    exact: true,
  });
  await instruction.fill("Check stretch and transfer all matching marks.");
  await instruction.press("Tab");
  await modal
    .getByRole("checkbox", { name: "Side seams", exact: true })
    .first()
    .check();
  await modal
    .getByRole("button", { name: "Check & handoff", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await modal
    .getByRole("button", { name: "Export construction ZIP", exact: true })
    .click();
  const path = info.outputPath("construction.zip");
  await (await download).saveAs(path);
  const zip = unzipSync(new Uint8Array(await fs.readFile(path)));
  await fs.writeFile(
    `qa/fashion-015/construction-${info.project.name}.pdf`,
    zip["cutting-pattern.pdf"],
  );
  const report = JSON.parse(strFromU8(zip["construction.json"]));
  expect(report.plan.seams).toHaveLength(3);
  expect(report.plan.steps[0].seamIds).toHaveLength(1);
  expect(report.plan.steps[0].instruction).toContain("Check stretch");
  expect(strFromU8(zip["cutting-pattern.svg"])).toMatch(/width="[\d.]+mm"/);
  await modal
    .getByRole("button", { name: "Close construction", exact: true })
    .click();
  await page
    .getByLabel("Garment design", { exact: true })
    .selectOption("titan");
  // New studies already contain the complete starter measurements.
  await expect(page.getByRole("button", {
    name: "Add missing sample measurements", exact: true,
  })).toHaveCount(0);
  await seams(page).click();
  await expect(modal.getByText(/This plan belongs to teagan/)).toBeVisible();
  await modal
    .getByRole("button", { name: "Start plan for current design", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Load design checklist", exact: true })
    .click();
  await expect(
    modal.getByRole("textbox", { name: "Seam name", exact: true }),
  ).toHaveValue("Inseam");
  await modal
    .getByRole("button", { name: "Close construction", exact: true })
    .click();
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const project = info.outputPath("construction.formstudio");
  await (await save).saveAs(project);
  const stored = JSON.parse(await fs.readFile(project, "utf8"));
  expect(stored.version).toBe(19);
  expect(stored.fashion.seamPlan.design).toBe("titan");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(project);
  await seams(page).click();
  await expect(
    modal.getByRole("textbox", { name: "Seam name", exact: true }),
  ).toHaveValue("Inseam");
  expect(errors).toEqual([]);
});
test("frozen specs, sample tolerances, colorways and export round trip", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fashion(page);
  await page.getByRole("button", { name: /Vector packs/ }).click();
  const tab = (name: string) =>
    page.locator(".vector-tabs").getByRole("button", { name, exact: true });
  await tab("Style & instructions").click();
  await page.getByLabel("Style code", { exact: true }).fill("FORM-015");
  await tab("Size specification").click();
  await page.getByLabel("Chest / hip width M", { exact: true }).fill("52");
  await page.getByLabel("Chest / hip width M", { exact: true }).press("Enter");
  await page.getByLabel("Confirm tolerance 1", { exact: true }).check();
  await tab("Samples & revisions").click();
  await page
    .getByLabel("Revision record name", { exact: true })
    .fill("Proto A");
  await page
    .getByRole("button", { name: "Record specification revision", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove revision Proto A", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Sample size", { exact: true }).selectOption("M");
  await page
    .getByRole("button", { name: "Add sample measurement record", exact: true })
    .click();
  await page.getByLabel("Sample Chest / hip width", { exact: true }).fill("53");
  await expect(
    page.getByText("Outside tolerance", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Sample findings and requested changes", { exact: true })
    .fill("Reduce chest width by 1 cm.");
  await page
    .getByLabel("Sample findings and requested changes", { exact: true })
    .press("Tab");
  await tab("Size specification").click();
  await page.getByLabel("Chest / hip width M", { exact: true }).fill("56");
  await page.getByLabel("Chest / hip width M", { exact: true }).press("Enter");
  await page
    .getByLabel("Specification units", { exact: true })
    .selectOption("in");
  await tab("Samples & revisions").click();
  await expect(
    page.getByLabel("Sample Chest / hip width", { exact: true }),
  ).toHaveValue("53");
  await expect(
    page.getByText("First sample · Size M · Rev A · cm", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("measurements: Chest / hip width changed", { exact: true }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".style-development").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/fashion-015/samples-${info.project.name}.png`,
  });
  await page.getByRole("button", { name: "Colorways", exact: true }).click();
  await page.getByRole("button", { name: "Add colorway", exact: true }).click();
  await page.getByLabel("Colorway 1 name", { exact: true }).fill("Ink / chalk");
  await page.getByLabel("Colorway 1 name", { exact: true }).press("Enter");
  await page
    .getByLabel("Colorway 1 material 1 color", { exact: true })
    .fill("Ink black");
  await page
    .getByLabel("Colorway 1 material 1 color", { exact: true })
    .press("Enter");
  await page
    .getByLabel("Colorway 1 material 1 reference", { exact: true })
    .fill("Supplier swatch 001");
  await page
    .getByLabel("Colorway 1 material 1 reference", { exact: true })
    .press("Enter");
  await tab("Style & instructions").click();
  await page.getByLabel("Pack revision", { exact: true }).fill("B");
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await expect(
    page.getByText(/measurements outside the recorded tolerance/),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export reviewed ZIP", exact: true })
    .click();
  const path = info.outputPath("style.zip");
  await (await download).saveAs(path);
  const zip = unzipSync(new Uint8Array(await fs.readFile(path))),
    pack = JSON.parse(strFromU8(zip["editable-vector-pack.json"]));
  expect(pack.version).toBe(4);
  expect(pack.units).toBe("in");
  expect(pack.development.revisions[0].spec.units).toBe("cm");
  expect(pack.development.samples[0].notes).toContain("Reduce chest");
  expect(strFromU8(zip["samples.csv"])).toContain(
    '"52","53","1","0.5","Outside tolerance"',
  );
  expect(strFromU8(zip["colorways.csv"])).toContain("Supplier swatch 001");
  await fs.writeFile(
    `qa/fashion-015/tech-pack-${info.project.name}.pdf`,
    zip["tech-pack.pdf"],
  );
  await tab("Technical flats").click();
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await page
    .getByLabel("Import vector pack file", { exact: true })
    .setInputFiles({
      name: "style.json",
      mimeType: "application/json",
      buffer: Buffer.from(zip["editable-vector-pack.json"]),
    });
  await tab("Samples & revisions").click();
  await expect(
    page.getByLabel("Sample Chest / hip width", { exact: true }),
  ).toHaveValue("53");
  await page.getByRole("button", { name: "Colorways", exact: true }).click();
  await expect(page.getByLabel("Colorway 1 name", { exact: true })).toHaveValue(
    "Ink / chalk",
  );
  expect(errors).toEqual([]);
});

test("callout links follow material renames and block export after linked records are removed", async ({
  page,
}) => {
  await fashion(page);
  await page.getByRole("button", { name: /Vector packs/ }).click();
  const tab = (name: string) =>
    page.locator(".vector-tabs").getByRole("button", { name, exact: true });
  await page.getByRole("button", { name: "Add callout", exact: true }).click();
  const canvas = page.getByRole("group", {
      name: "Front and back garment flats",
      exact: true,
    }),
    b = (await canvas.boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.22, b.y + b.height * 0.3);
  await page
    .getByLabel("Callout instruction", { exact: true })
    .fill("Join shoulder seam with stretch stitch.");
  await tab("Samples & revisions").click();
  await page
    .getByRole("button", { name: "Linked callouts", exact: true })
    .click();
  await page
    .getByLabel("Callout 1 Component", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Callout 1 Material", { exact: true })
    .selectOption({ label: "FAB-01" });
  await page
    .getByLabel("Callout 1 Point of measure", { exact: true })
    .selectOption({ label: "Chest / hip width" });
  await tab("Materials & trims").click();
  await page.getByLabel("Material 1 code", { exact: true }).fill("JERSEY-01");
  await tab("Samples & revisions").click();
  await page
    .getByRole("button", { name: "Linked callouts", exact: true })
    .click();
  await expect(
    page
      .getByLabel("Callout 1 Material", { exact: true })
      .locator("option:checked"),
  ).toHaveText("JERSEY-01");
  await tab("Materials & trims").click();
  await page
    .getByRole("button", { name: "Remove material 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await expect(
    page.getByText(/Callout 1: linked material is missing\./),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export reviewed ZIP", exact: true }),
  ).toBeDisabled();
});
