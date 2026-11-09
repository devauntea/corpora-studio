import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("studio home and body browser guide tasks without losing the current study", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Studio home", exact: true }).click();
  const home = page.getByRole("dialog", { name: "Studio home" });
  await expect(home).toBeVisible();
  await expect(
    home.getByRole("button", { name: /Plan a tattoo/ }),
  ).toBeVisible();
  await expect(
    home.getByRole("button", { name: /Draft a garment/ }),
  ).toBeVisible();
  await expect(
    home.getByRole("button", { name: /Create a technical flat/ }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".studio-home")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/studio-018/${info.project.name}-home.png`,
  });
  await home.getByRole("button", { name: "Close studio home" }).click();
  await expect(
    page.getByRole("button", { name: "Studio home", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Choose body/ }).click();
  const models = page.getByRole("dialog", { name: "Find your canvas." });
  await expect(models).toBeVisible();
  await page.getByLabel("Search body models").fill("sculpt hand");
  await models
    .getByRole("button", { name: /Sculpt hand/ })
    .first()
    .click();
  await expect(
    models.getByRole("button", { name: "Use sculpt hand", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".body-library-dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/studio-018/${info.project.name}-body-library.png`,
  });
  await models
    .getByRole("button", { name: "Use sculpt hand", exact: true })
    .click();
  await expect(models).toHaveCount(0);
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .locator(".canvas-host")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ model: { sculptId: "sculpt-hand" } });
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .locator(".canvas-host")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ section: "full-arm" });
  await page.getByLabel("Find artwork layers").fill("missing");
  await expect(page.getByText("No matching artwork.")).toBeVisible();
  await page.getByRole("button", { name: "Clear layer search" }).click();
  await expect(
    page.getByRole("button", { name: /Solar botanical 95 mm/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Place & adjust/ }).click();
  await expect(page.getByLabel("Active canvas tool")).toContainText(
    "Place artwork",
  );
  await page.screenshot({
    path: `qa/studio-018/${info.project.name}-tattoo-workspace.png`,
  });
  await page
    .getByRole("spinbutton", { name: "Width", exact: true })
    .fill("120");
  await page
    .getByRole("spinbutton", { name: "Width", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Studio home", exact: true }).click();
  await home.getByRole("button", { name: /Create a technical flat/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your latest changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Solar study",
  );
  await page.getByRole("button", { name: "Studio home", exact: true }).click();
  await home.getByRole("button", { name: /Create a technical flat/ }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Untitled technical flat",
  );
  await expect(page.locator(".vector-studio")).toBeVisible();
  expect(errors).toEqual([]);
});

test("task creation resets the actual camera and the stencil shortcut opens its output tools", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Make stencil/ }).click();
  const stencil = page.getByRole("dialog", {
    name: "Calibrated stencil studio",
  });
  await expect(stencil).toBeVisible();
  await stencil.getByRole("button", { name: "Close stencil studio" }).click();
  await page
    .getByRole("dialog", { name: "Tattoo image studio" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "back", exact: true }).click();
  await page.getByRole("button", { name: "Studio home", exact: true }).click();
  await page.getByRole("button", { name: /Plan a tattoo/ }).click();
  const models = page.getByRole("dialog", { name: "Find your canvas." });
  await models
    .getByRole("button", { name: "Use full arm", exact: true })
    .click();
  const host = page.locator(".canvas-host");
  await expect(host).toHaveAttribute("data-rendered-body", /full-arm/);
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Untitled composition",
  );
  // Canvas screenshots include the DOM controls over its bounds. Keep hover
  // outside the stage so this comparison measures the camera, not button chrome.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(200);
  const automaticCamera = await host.getAttribute("data-camera");
  const automatic = await host.locator("canvas").screenshot();
  await page.getByRole("button", { name: "front", exact: true }).click();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(200);
  await expect(host).toHaveAttribute("data-camera", automaticCamera!);
  const explicit = await host.locator("canvas").screenshot();
  expect(automatic.equals(explicit)).toBe(true);
});
