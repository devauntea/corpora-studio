import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { sculptCatalog, sculptGroupFor } from "../../src/sculpt-catalog";
test("audit tattoo conformance on every active import and both body libraries in flexed poses", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const host = page.locator(".canvas-host"),
    report: any[] = [];
  const body = async () =>
    JSON.parse((await host.getAttribute("data-rendered-body")) || "{}");
  const inspect = async (name: string) => {
    await page.getByRole("button", { name: "Artwork", exact: true }).click();
    const position = page.getByRole("spinbutton", {
      name: "Around surface",
      exact: true,
    });
    await position.fill(name.endsWith("back-flex") ? "180" : "0");
    await position.press("Enter");
    const connected = page.getByRole("switch", {
      name: "Connected surface placement",
    });
    if ((await connected.getAttribute("aria-checked")) !== "true")
      await connected.click();
    const toggle = page.getByRole("switch", {
      name: "Inspect surface distortion",
    });
    if ((await toggle.getAttribute("aria-checked")) !== "true")
      await toggle.click();
    await expect
      .poll(async () =>
        Number(await host.getAttribute("data-connected-triangles")),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await host.getAttribute("data-surface-inspection")) || "{}",
          ).triangles ?? 0,
      )
      .toBeGreaterThan(0);
    const stats = JSON.parse(
      (await host.getAttribute("data-surface-inspection")) || "{}",
    );
    expect(Object.values(stats).every((v) => Number.isFinite(v))).toBe(true);
    report.push({ name, ...stats });
    await toggle.click();
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await host.getAttribute("data-surface-inspection")) || "{}",
          ).triangles,
      )
      .toBe(0);
    await page
      .getByRole("button", {
        name: name.endsWith("back-flex") ? "back" : "three-quarter",
        exact: true,
      })
      .click();
    await host.screenshot({ path: info.outputPath(`${name}.png`) });
  };
  for (const entry of sculptCatalog.filter(
    (e) => e.groupId !== "derived-anatomy",
  )) {
    await page.getByRole("button", { name: "Body model", exact: true }).click();
    await page
      .getByLabel("Body region")
      .selectOption(sculptGroupFor(entry.id)!.id);
    if (entry.groupId)
      await page.getByLabel("Imported leg pose").selectOption(entry.id);
    await expect.poll(body).toMatchObject({ model: { sculptId: entry.id } });
    await inspect(entry.id);
  }
  for (const sex of ["Male", "Female"]) {
    for (const physique of ["Fit", "Average"]) {
      for (const [section, pose] of [
        ["full-arm", "joint"],
        ["full-leg", "joint"],
        ["upper-body", "chest-flex"],
        ["upper-body", "back-flex"],
        ["full-body", "double-biceps"],
      ]) {
        await page
          .getByRole("button", { name: "Body model", exact: true })
          .click();
        await page.getByLabel("Body region").selectOption(section);
        await page.getByRole("button", { name: sex, exact: true }).click();
        await page.getByRole("button", { name: physique, exact: true }).click();
        if (pose === "joint")
          await page
            .getByRole("button", { name: "Bent 90°", exact: true })
            .click();
        else
          await page
            .getByLabel("Muscle pose", { exact: true })
            .selectOption(pose);
        await expect.poll(body).toMatchObject({
          section,
          model: { sex: sex.toLowerCase(), physique: physique.toLowerCase() },
        });
        await inspect(`${sex}-${physique}-${section}-${pose}`);
      }
    }
  }
  await fs.writeFile(
    info.outputPath("fit-audit.json"),
    JSON.stringify(report, null, 2),
  );
  expect(errors).toEqual([]);
});
