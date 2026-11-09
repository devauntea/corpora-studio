import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("pattern workflow opens the relevant controls without changing the draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  const draft = page.locator('[data-piece="front"] g path').first();
  const original = await draft.getAttribute("d");
  await page
    .getByLabel("Search patterns", { exact: true })
    .fill("no-such-pattern-xyz");
  await expect(
    page.getByText("No patterns match these filters."),
  ).toBeVisible();
  await expect(draft).toHaveAttribute("d", original!);
  await page.getByRole("button", { name: "Clear pattern filters" }).click();
  await expect(page.getByLabel("Search patterns", { exact: true })).toHaveValue(
    "",
  );

  const flow = page.getByRole("navigation", { name: "Pattern workflow" });
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expect(page.locator(".fashion-catalog")).not.toHaveAttribute("open");
  await expect
    .poll(() => page.locator(".fashion-library").evaluate((el) => el.scrollTop))
    .toBe(0);
  await flow.getByRole("button", { name: /Measurements & fit/ }).click();
  await expect(page.locator(".fashion-catalog")).not.toHaveAttribute("open");
  await expect(
    page.getByRole("spinbutton", { name: "High hips", exact: true }),
  ).toBeVisible();
  await flow.getByRole("button", { name: /Edit & construct/ }).click();
  await expect(
    page.getByRole("button", { name: "Pieces", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Add custom pattern piece" }),
  ).toBeVisible();
  await flow.getByRole("button", { name: /Review output/ }).click();
  await expect(
    page.getByRole("button", { name: "Print & export", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Edit at full size/ }).click();
  await expect(page.getByLabel("Pattern export format")).toHaveValue("svg");
  await expect(
    page.getByRole("button", { name: "Export SVG", exact: true }),
  ).toBeVisible();
  await expect(draft).toHaveAttribute("d", original!);
  await flow.getByRole("button", { name: /Choose pattern/ }).click();
  await expect(
    page.getByLabel("Search patterns", { exact: true }),
  ).toBeFocused();
});

test("vector workflow guides empty drawings, view selection and handoff intent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page.getByRole("button", { name: "Open vector workspace" }).click();
  await page.getByRole("button", { name: "Blank canvas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a garment shape" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Draw from scratch" }).click();
  await expect(
    page.getByRole("button", { name: "Draw path", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Drawing a new path" }),
  ).toBeVisible();
  await expect(page.locator(".vector-empty-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Work on back view" }).click();
  await expect(
    page.getByLabel("Active garment view", { exact: true }),
  ).toHaveValue("back");
  await expect(page.locator(".vector-canvas-status")).toContainText(
    "back artboard",
  );
  await page.getByRole("button", { name: /Next: Define sizes/ }).click();
  await expect(
    page.getByRole("button", { name: "Size specification", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next: Add materials/ }).click();
  await expect(
    page.getByRole("button", { name: "Materials & trims", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Vector export format").selectOption("svg");
  await expect(page.locator("#vector-export-intent")).toContainText(
    "Dimensions stay in the size specification",
  );
  await page
    .getByRole("button", { name: "Technical flats", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select / move", exact: true })
    .click();
  const accessibility = await new AxeBuilder({ page })
    .include(".vector-studio")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
