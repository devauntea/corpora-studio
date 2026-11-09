import { test, expect } from "@playwright/test";

test("skeleton-backed leg bending and linked knee comparison keep the anatomy filter on the same surface", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("full-leg");
  const host = page.locator(".canvas-host");
  await expect(host).toHaveAttribute("data-rig-bones", "163");
  await page
    .getByRole("button", { name: "Skin tone #cfae9f", exact: true })
    .click();
  for (const sex of ["Male", "Female"]) {
    await page.getByRole("button", { name: sex, exact: true }).click();
    await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse((await host.getAttribute("data-rendered-body")) || "{}"),
      )
      .toMatchObject({
        flex: 90,
        model: { sex: sex.toLowerCase(), revision: 9 },
      });
    await page
      .locator(".camera-tabs")
      .getByRole("button", { name: "left", exact: true })
      .click();
    await page.getByRole("button", { name: "Fit model", exact: true }).click();
    await host.screenshot({
      path: info.outputPath(`${sex.toLowerCase()}-knee-90.png`),
    });
    await page.getByRole("button", { name: "Muscles", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse((await host.getAttribute("data-rendered-body")) || "{}"),
      )
      .toMatchObject({ anatomy: true, flex: 90 });
    await host.screenshot({
      path: info.outputPath(`${sex.toLowerCase()}-knee-anatomy.png`),
    });
    await page.getByRole("button", { name: "Skin", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Pose & sleeve study", exact: true })
    .click();
  const study = page.getByRole("dialog", { name: "Tattoo composition study" });
  await expect(study.getByRole("status")).toContainText("cameras stay linked", {
    timeout: 90000,
  });
  await expect(page.getByTestId("flex-view")).toHaveAttribute(
    "data-rig-bones",
    "163",
  );
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .getByTestId("flex-view")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ flex: 90 });
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .getByTestId("rest-view")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ flex: 0 });
  await study.getByLabel("Linked camera").selectOption("left");
  await study.screenshot({ path: info.outputPath("knee-comparison.png") });
  expect(errors).toEqual([]);
});
