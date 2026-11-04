import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("fashion drafting, constrained shape editing, history, exports and shared project round trip", async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:1420")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Everyday tee" }),
  ).toBeVisible();
  await expect(page.locator("[data-piece]")).toHaveCount(4);
  const front = page
    .locator('[data-piece="front"] g')
    .first()
    .locator("path")
    .first();
  const original = await front.getAttribute("d");
  const hips = page.getByRole("spinbutton", { name: "Hips", exact: true });
  await hips.fill("1111");
  await hips.press("Escape");
  await expect(hips).toHaveValue("1000");
  await hips.fill("1120");
  await hips.press("Enter");
  await expect(front).not.toHaveAttribute("d", original!);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(hips).toHaveValue("1000");
  await expect(front).toHaveAttribute("d", original!);
  await page.getByRole("button", { name: "Edit pattern shape" }).click();
  const handle = page.locator('[data-handle="neck"] circle'),
    box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 22, {
    steps: 6,
  });
  await page.mouse.up();
  const depth = page.getByRole("spinbutton", {
    name: "Neckline depth",
    exact: true,
  });
  await expect(depth).not.toHaveValue("25");
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(depth).toHaveValue("25");
  await page.getByRole("button", { name: "Relaxed", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Chest ease", exact: true }),
  ).toHaveValue("24");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Garment notes" })
    .fill("Cotton jersey. Test ribbing recovery.");
  await page.getByRole("button", { name: "Arrange pattern pieces" }).click();
  const sleeve = page.locator('[data-piece="sleeve"]');
  const before = await sleeve.getAttribute("transform"),
    sb = (await sleeve.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 - 20, sb.y + sb.height / 2 + 35, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(sleeve).not.toHaveAttribute("transform", before!);
  await page
    .getByRole("button", { name: "Print & export", exact: true })
    .click();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdfPath = testInfo.outputPath("fashion-a4.pdf");
  await (await pdfDownload).saveAs(pdfPath);
  expect((await fs.readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByLabel("Pattern paper size").selectOption("letter");
  const letterDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (
    await letterDownload
  ).saveAs(testInfo.outputPath("fashion-letter.pdf"));
  await page.getByLabel("Pattern export format").selectOption("svg");
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svgPath = testInfo.outputPath("fashion.svg");
  await (await svgDownload).saveAs(svgPath);
  expect(await fs.readFile(svgPath, "utf8")).toContain(
    'width="50" height="50"',
  );
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const projectPath = testInfo.outputPath("garment.formstudio");
  await (await save).saveAs(projectPath);
  const stored = JSON.parse(await fs.readFile(projectPath, "utf8"));
  expect(stored.fashion.notes).toBe("Cotton jersey. Test ribbing recovery.");
  expect(stored.version).toBe(8);
  expect(stored.layers).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("fashion-workspace.png") });
  await page.getByRole("button", { name: "Tattoo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(projectPath);
  await expect(
    page.getByRole("heading", { name: "Everyday tee" }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Chest ease", exact: true }),
  ).toHaveValue("24");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Garment notes" }),
  ).toHaveValue(stored.fashion.notes);
  await expect(sleeve).not.toHaveAttribute("transform", before!);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("invalid profiles recover through undo and never export a stale draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  const field = page.getByRole("spinbutton", {
    name: "High shoulder to bust",
    exact: true,
  });
  await field.fill("450");
  await field.press("Enter");
  const waist = page.getByRole("spinbutton", {
    name: "High shoulder to waist",
    exact: true,
  });
  await waist.fill("350");
  await waist.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Check your measurements" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Print & export", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export PDF", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(page.locator("[data-piece]")).toHaveCount(4);
});
