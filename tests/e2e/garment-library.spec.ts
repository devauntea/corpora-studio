import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

async function openLibrary(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByLabel("Search quick actions").fill("garment asset");
  await page.getByLabel("Search quick actions").press("Enter");
  await expect(
    page.getByRole("region", { name: "Garment asset library" }),
  ).toBeVisible();
}
test("imported garment views remain editable through undo, manufacturer export and project reopen", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openLibrary(page);
  await expect(page.locator(".garment-card")).toHaveCount(112);
  await page.getByLabel("Search garment assets").fill("Hoodie");
  await page
    .getByRole("button", { name: "Preview Hoodie", exact: true })
    .click();
  await page.getByRole("button", { name: "Vector trace", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Hoodie editable trace" }),
  ).toBeVisible();
  await page.getByLabel("Replace drawings on destination").check();
  await page
    .getByRole("button", { name: "Add pair to front & back", exact: true })
    .click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(4);
  await expect(page.getByLabel("Vector layer name")).toHaveValue(
    "Hoodie · View 1 · Fabric",
  );
  await page.getByLabel("Path fill", { exact: true }).fill("#8596a3");
  const fabric = page.getByRole("button", {
    name: "Select front Hoodie · View 1 · Fabric",
    exact: true,
  });
  await expect(fabric).toHaveAttribute("fill", "#8596a3");
  await page.getByRole("button", { name: "Edit points", exact: true }).click();
  await page.getByLabel("Selected contour").selectOption("1");
  await page.getByLabel("Selected anchor").selectOption("0");
  const before = await fabric.getAttribute("d");
  const anchor = page.getByRole("spinbutton", {
    name: "Anchor X",
    exact: true,
  });
  await anchor.fill(String(Number(await anchor.inputValue()) + 3));
  await anchor.press("Enter");
  await expect(fabric).not.toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Undo vector edit", exact: true })
    .click();
  await expect(fabric).toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Redo vector edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select / move", exact: true })
    .click();
  await page.screenshot({
    path: `qa/garment-library/placed-${info.project.name}.png`,
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  const zipPath = info.outputPath("garment.zip");
  await (await download).saveAs(zipPath);
  const entries = unzipSync(new Uint8Array(await fs.readFile(zipPath)));
  const pack = JSON.parse(strFromU8(entries["editable-vector-pack.json"]));
  expect(pack.version).toBe(2);
  expect(pack.layers).toHaveLength(4);
  expect(pack.layers[0].contours.length).toBeGreaterThan(0);
  expect(strFromU8(entries["front.svg"])).toContain('fill-rule="evenodd"');
  expect(strFromU8(entries["front.svg"])).not.toContain("<image");
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const projectPath = info.outputPath("garment.formstudio");
  await (await saved).saveAs(projectPath);
  const project = JSON.parse(await fs.readFile(projectPath, "utf8"));
  expect(project.version).toBe(12);
  expect(project.fashion.vectorPack).toEqual(pack);
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(0);
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(projectPath);
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  if (await discard.isVisible()) await discard.click();
  await page
    .getByRole("button", { name: "Open vector workspace", exact: true })
    .click();
  await expect(page.locator("[data-vector-layer]")).toHaveCount(4);
  await expect(fabric).toHaveAttribute("fill", "#8596a3");
  expect(errors).toEqual([]);
});

test("asset discovery, favorites, four-view accessories and keyboard navigation", async ({
  page,
}, info) => {
  await openLibrary(page);
  const categories = page.getByRole("navigation", { name: "Asset categories" });
  await categories.getByRole("button", { name: /Accessories/ }).click();
  await page.getByLabel("Search garment assets").fill("Backpack");
  await expect(page.locator(".garment-card")).toHaveCount(3);
  await page.getByLabel("Search garment assets").fill("no matching garment");
  await expect(
    page.getByRole("heading", { name: "No matching assets" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all assets", exact: true })
    .click();
  await page.getByLabel("Search garment assets").fill("Hat Trucker");
  await page
    .getByRole("button", { name: "Favorite Hat Trucker", exact: true })
    .click();
  await categories.getByRole("button", { name: /Favorites/ }).click();
  await expect(page.locator(".garment-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Preview Hat Trucker", exact: true })
    .click();
  await expect(page.locator(".garment-view-picks button")).toHaveCount(4);
  await page.getByRole("button", { name: "View 4", exact: true }).click();
  await page.getByRole("button", { name: "Vector trace", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Hat Trucker editable trace" }),
  ).toBeVisible();
  await page.screenshot({
    path: `qa/garment-library/library-${info.project.name}.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .include(".garment-library")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByLabel("Asset destination view").selectOption("back");
  await page.getByLabel("Replace drawings on destination").check();
  await page
    .getByRole("button", { name: "Add selected view", exact: true })
    .click();
  await expect(page.getByLabel("Active garment view")).toHaveValue("back");
  await expect(page.getByLabel("Vector layer name")).toHaveValue(
    "Hat Trucker · View 4 · Fabric",
  );
  await page
    .getByRole("button", { name: "Hide panels for focus mode", exact: true })
    .click();
  await expect(page.locator(".vector-sidebar")).toBeHidden();
  await page
    .getByRole("button", { name: "Show workspace panels", exact: true })
    .click();
  await expect(page.locator(".vector-sidebar")).toBeVisible();
  await page
    .getByRole("button", { name: "Open pattern workspace", exact: true })
    .click();
  await expect(page.getByLabel("Garment design")).toBeVisible();
  await page
    .getByRole("button", { name: "Open vector workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Select back Hat Trucker · View 4 · Fabric",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Browse garment library", exact: true })
    .click();
  await categories.getByRole("button", { name: /Favorites/ }).click();
  await expect(page.locator(".garment-card")).toHaveCount(1);
  await page.setViewportSize({ width: 1080, height: 800 });
  await page.screenshot({
    path: `qa/garment-library/compact-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1080);
  await page
    .getByRole("button", { name: "Quick actions (⌘K)", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Quick actions",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const commands = await new AxeBuilder({ page })
    .include(".command-menu")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(commands.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Quick actions (⌘K)", exact: true }),
  ).toBeFocused();
});
