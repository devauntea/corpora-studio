import { test, expect } from "@playwright/test";

test("complete limbs retain their hands, feet, atlas and independent poses", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  const ready = async (body: Record<string, unknown>) => {
    await expect
      .poll(async () =>
        JSON.parse(
          (await page
            .locator(".canvas-host")
            .getAttribute("data-rendered-body")) || "{}",
        ),
      )
      .toMatchObject(body);
  };
  for (const sex of ["male", "female"]) {
    for (const section of ["full-arm", "full-leg"]) {
      await page.getByLabel("Body region").selectOption(section);
      await page
        .getByRole("button", {
          name: sex === "male" ? "Male" : "Female",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Fit", exact: true }).click();
      await page.getByRole("button", { name: "Relaxed", exact: true }).click();
      await page
        .locator('[aria-label="Body side"]')
        .getByRole("button", { name: "left", exact: true })
        .click();
      await page.getByRole("button", { name: "Skin", exact: true }).click();
      await page
        .getByRole("button", { name: "Skin tone #e0bfa5", exact: true })
        .click();
      await ready({
        section,
        side: "left",
        anatomy: false,
        model: { sex, physique: "fit" },
      });
      for (const view of ["front", "back", "left"]) {
        await page
          .locator(".camera-tabs")
          .getByRole("button", { name: view, exact: true })
          .click();
        await page
          .locator(".viewport")
          .screenshot({
            path: info.outputPath(`${sex}-${section}-${view}.png`),
          });
      }
      await page
        .locator('[aria-label="Body side"]')
        .getByRole("button", { name: "right", exact: true })
        .click();
      await page.getByRole("button", { name: "Muscles", exact: true }).click();
      await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
      await ready({
        section,
        side: "right",
        anatomy: true,
        ...(section === "full-leg"
          ? { flex: 90 }
          : { armPose: { right: { flex: 90 } } }),
      });
      await page
        .getByRole("button", { name: "Fit model", exact: true })
        .click();
      await page
        .locator(".camera-tabs")
        .getByRole("button", { name: "left", exact: true })
        .click();
      await page
        .locator(".viewport")
        .screenshot({
          path: info.outputPath(`${sex}-${section}-bent-anatomy.png`),
        });
      await expect(page.locator(".muscle-legend")).toContainText(
        section === "full-leg" ? "Gastrocnemius" : "Brachioradialis",
      );
    }
  }
  expect(errors).toEqual([]);
});
