import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

const theme = (page: Page) => page.getByLabel("Appearance", { exact: true });

for (const [width, height] of [
  [1080, 720],
  [1440, 940],
]) {
  test(`dark theme persists across studios without changing artwork at ${width}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".canvas-host")).toHaveAttribute(
      "data-rendered-body",
      /full-arm/,
    );
    await theme(page).selectOption("light");
    await page.getByRole("button", { name: "Fashion", exact: true }).click();
    await page.getByRole("button", { name: "Open vector workspace" }).click();
    await expect(page.locator(".vector-canvas")).toBeVisible();
    const artColors = () =>
      page.locator(".vector-canvas path").evaluateAll((els) =>
        els.map((el) => ({
          d: el.getAttribute("d"),
          fill: getComputedStyle(el).fill,
          stroke: getComputedStyle(el).stroke,
        })),
      );
    const beforeColors = await artColors();
    const save = async (name: string) => {
      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const file = info.outputPath(name + ".formstudio");
      await (await downloading).saveAs(file);
      return JSON.parse(await fs.readFile(file, "utf8"));
    };
    const before = await save("before-theme");
    const dirty = await page.locator(".save-state").textContent();
    await theme(page).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await artColors()).toEqual(beforeColors);
    expect(await page.locator(".save-state").textContent()).toEqual(dirty);
    expect(await save("after-theme")).toEqual(before);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".vector-studio")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${width}-dark-vectors.png`),
    });
    await page.getByRole("button", { name: "Tattoo", exact: true }).click();
    await expect(page.locator(".canvas-host")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const tone = JSON.parse(
      (await page.locator(".canvas-host").getAttribute("data-rendered-body"))!,
    );
    expect(tone.skin).toEqual(before.body.skin);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".library")
          .include(".inspector")
          .include(".topbar")
          .include(".statusbar")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${width}-dark-tattoo.png`),
    });
    await page.reload();
    await expect(theme(page)).toHaveValue("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await theme(page).selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
}

test("system theme follows OS changes and applies to discovery dialogs", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".canvas-host")).toHaveAttribute(
    "data-rendered-body",
    /full-arm/,
  );
  await theme(page).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Studio home", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".studio-home")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("dark-home.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Choose body/ }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".body-library-dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("dark-body-library.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(page.locator(".fashion-workspace")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".fashion-workspace")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("dark-fashion.png") });
  await page
    .getByRole("button", { name: /Browse .* drafted patterns/ })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".pattern-catalog-dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("dark-pattern-library.png") });
  await page.getByRole("button", { name: "Close pattern library" }).click();
  await theme(page).selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("dark theme covers image, stencil and source editors while keeping previews intact", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1080, height: 720 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".canvas-host")).toHaveAttribute(
    "data-rendered-body",
    /full-arm/,
  );
  await theme(page).selectOption("dark");
  await page
    .getByRole("button", { name: /Edit source in image studio/ })
    .click();
  const art = page.getByRole("dialog", { name: "Tattoo image studio" });
  await expect(art).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".artwork-studio")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await art
      .locator("canvas")
      .first()
      .evaluate((el) => getComputedStyle(el).filter),
  ).toBe("none");
  await page.screenshot({
    path: info.outputPath("1080-dark-image-studio.png"),
  });
  await art.getByRole("button", { name: "Stencil output" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".tattoo-stencil")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("1080-dark-stencil.png") });
  await page.getByRole("button", { name: "Close stencil studio" }).click();
  await art.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", { name: "Open pattern image inventory" })
    .click();
  await expect(page.locator(".pattern-source-studio")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".pattern-source-studio")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("1080-dark-source-editor.png"),
  });
});

test("dark fashion tools keep collection and production information readable", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1080, height: 720 });
  await page.goto("/");
  await theme(page).selectOption("dark");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("button", { name: "Seams & construction →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load design checklist", exact: true })
    .click();
  const check = async (selector: string, image: string) => {
    await expect(page.locator(selector)).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include(selector)
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(image + ".png") });
  };
  await check(".fashion-development-dialog", "dark-seam-tools");
  await page
    .getByRole("button", { name: "Close construction", exact: true })
    .click();
  await page.getByRole("button", { name: "Open vector workspace" }).click();
  await page
    .getByRole("button", { name: "Browse garment flats", exact: true })
    .click();
  await check(".garment-library", "dark-garment-assets");
  await page
    .getByRole("button", { name: "Open vector workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Samples & revisions", exact: true })
    .click();
  await check(".style-development", "dark-sample-revisions");
  for (const [name, image] of [
    ["Size specification", "dark-size-specification"],
    ["Materials & trims", "dark-materials"],
    ["Style & instructions", "dark-style-instructions"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await check(".vector-studio", image);
  }
  await page
    .getByRole("button", { name: "Export vector pack", exact: true })
    .click();
  await check(".vector-review", "dark-vector-handoff");
});
