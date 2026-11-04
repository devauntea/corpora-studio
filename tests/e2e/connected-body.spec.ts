import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("continuous body, neck and connected distortion placement survive saving", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Solar botanical" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  const ready = async (section: string) =>
    expect
      .poll(async () =>
        JSON.parse(
          (await page
            .locator(".canvas-host")
            .getAttribute("data-rendered-body")) || "{}",
        ),
      )
      .toMatchObject({ section, model: { revision: 4 } });
  await page.getByLabel("Body region").selectOption("full-body");
  await ready("full-body");
  await page
    .locator(".viewport")
    .screenshot({
      path: `qa/next-features/full-body-${info.project.name}.png`,
    });
  await page.getByRole("switch", { name: "Muscle anatomy guide" }).click();
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .locator(".canvas-host")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ anatomy: true });
  await page
    .locator(".viewport")
    .screenshot({
      path: `qa/next-features/full-anatomy-${info.project.name}.png`,
    });
  await page.getByLabel("Body region").selectOption("neck");
  await ready("neck");
  await page
    .locator(".viewport")
    .screenshot({ path: `qa/next-features/neck-${info.project.name}.png` });
  await page.getByLabel("Body region").selectOption("full-body");
  await ready("full-body");
  await page.getByRole("button", { name: "Artwork", exact: true }).click();
  await page.getByLabel("Placement surface").selectOption("trunk");
  await page
    .getByRole("switch", { name: "Connected surface placement" })
    .click();
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".canvas-host")
          .getAttribute("data-connected-triangles"),
      ),
    )
    .toBeGreaterThan(20);
  await page
    .getByRole("switch", { name: "Inspect surface distortion" })
    .click();
  await expect(
    page.getByText(/mapped triangles\. 95th percentile/),
  ).toBeVisible();
  await page
    .locator(".viewport")
    .screenshot({
      path: `qa/next-features/connected-${info.project.name}.png`,
    });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const path = info.outputPath("connected.formstudio");
  await (await dl).saveAs(path);
  const saved = JSON.parse(await fs.readFile(path, "utf8"));
  expect(saved.layers[0].surface).toMatchObject({ revision: 4, sex: "male" });
  await page
    .getByRole("switch", { name: "Connected surface placement" })
    .click();
  await page.getByLabel("Project file", { exact: true }).setInputFiles(path);
  await expect(
    page.getByRole("switch", { name: "Connected surface placement" }),
  ).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});
