import { test, expect } from "@playwright/test";

test("pattern construction detail is optional and does not edit the current draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await expect(page.locator(".pattern-piece").first()).toBeVisible();
  const pieces = await page.locator(".pattern-piece").count();
  const name = await page.getByLabel("Measurement profile name").inputValue();
  await page
    .getByRole("button", { name: /Browse .* drafted patterns/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pattern catalog",
    exact: true,
  });
  const hero = dialog.locator(".pattern-catalog-hero img");
  const plain = await hero.getAttribute("src");
  expect(decodeURIComponent(plain!)).not.toContain('data-preview="allowance"');
  await dialog
    .getByRole("button", { name: "Construction lines", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Construction lines", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(decodeURIComponent((await hero.getAttribute("src"))!)).toContain(
    'data-preview="allowance"',
  );
  // The thumbnail collection remains quiet while only the chosen detail gains construction marks.
  const thumb = await dialog
    .locator(".pattern-preview-card img")
    .first()
    .getAttribute("src");
  expect(decodeURIComponent(thumb!)).not.toContain('data-preview="allowance"');
  await dialog
    .getByRole("button", { name: "Construction lines", exact: true })
    .click();
  await expect(hero).toHaveAttribute("src", plain!);
  await dialog.getByRole("button", { name: "Close pattern library" }).click();
  await expect(page.getByLabel("Measurement profile name")).toHaveValue(name);
  await expect(page.locator(".pattern-piece")).toHaveCount(pieces);
});
