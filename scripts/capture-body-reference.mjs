// Reproducible render review. Run against the local development/preview server.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const output = "qa/body-fidelity";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1.5,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const ready = async (value) =>
  expect
    .poll(async () =>
      JSON.parse(
        (await page
          .locator(".canvas-host")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject(value);
const frames = () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const images = [];
const capture = async (name) => {
  await frames();
  await page
    .locator(".canvas-host")
    .screenshot({ path: `${output}/${name}.png` });
  images.push(name);
};
try {
  await page.goto(process.env.STUDIO_URL || "http://127.0.0.1:1420");
  await page
    .getByRole("button", { name: "Hide Solar botanical", exact: true })
    .click();
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("upper-body");
  await page
    .getByRole("button", { name: "Skin tone #cfae9f", exact: true })
    .click();
  for (const sex of ["male", "female"]) {
    await page
      .getByRole("button", {
        name: sex === "male" ? "Male" : "Female",
        exact: true,
      })
      .click();
    for (const physique of ["fit", "average"]) {
      await page
        .getByRole("button", {
          name: physique === "fit" ? "Fit" : "Average",
          exact: true,
        })
        .click();
      await ready({ model: { revision: 5, sex, physique } });
      for (const section of ["upper-body", "full-arm", "full-leg"]) {
        await page.getByLabel("Body region").selectOption(section);
        await ready({ section });
        for (const view of ["front", "back", "left"]) {
          await page
            .locator(".camera-tabs")
            .getByRole("button", { name: view, exact: true })
            .click();
          if (section === "upper-body")
            await page
              .getByRole("button", { name: "Zoom in", exact: true })
              .click();
          await capture(`${sex}-${physique}-${section}-${view}`);
        }
        if (section === "upper-body") {
          for (const [pose, view] of [
            ["chest-flex", "front"],
            ["back-flex", "back"],
          ]) {
            await page
              .getByLabel("Muscle pose", { exact: true })
              .selectOption(pose);
            await page
              .getByRole("spinbutton", { name: "Muscle tension", exact: true })
              .fill("100");
            await page
              .getByRole("spinbutton", { name: "Muscle tension", exact: true })
              .press("Enter");
            await ready({ musclePose: pose, muscleTension: 1 });
            await page
              .locator(".camera-tabs")
              .getByRole("button", { name: view, exact: true })
              .click();
            await page
              .getByRole("button", { name: "Zoom in", exact: true })
              .click();
            await capture(`${sex}-${physique}-${pose}`);
          }
          await page
            .getByLabel("Muscle pose", { exact: true })
            .selectOption("relaxed");
          await ready({ musclePose: "relaxed" });
        }
      }
    }
  }
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByLabel("Body region").selectOption("upper-body");
  await ready({ section: "upper-body" });
  await page.getByRole("button", { name: "Muscles", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .press("Enter");
  await ready({ anatomy: true, model: { anatomyOpacity: 1 } });
  for (const view of ["front", "back", "left"]) {
    await page
      .locator(".camera-tabs")
      .getByRole("button", { name: view, exact: true })
      .click();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await capture(`anatomy-${view}`);
  }
  await page.getByLabel("Body region").selectOption("full-arm");
  await ready({ section: "full-arm" });
  await page.getByRole("button", { name: "Muscles", exact: true }).click();
  await page.getByRole("button", { name: "Bent 90°", exact: true }).click();
  await ready({ armPose: { left: { flex: 90 } } });
  await capture("anatomy-flex");
  await page.getByLabel("Body region").selectOption("full-body");
  await ready({ section: "full-body" });
  await page
    .getByLabel("Muscle pose", { exact: true })
    .selectOption("double-biceps");
  await ready({ musclePose: "double-biceps" });
  await page
    .locator(".camera-tabs")
    .getByRole("button", { name: "back", exact: true })
    .click();
  await capture("double-biceps-skin");
  await page.getByRole("button", { name: "Muscles", exact: true }).click();
  await ready({ anatomy: true });
  await capture("double-biceps-anatomy");
  await fs.writeFile(
    `${output}/render-review.html`,
    `<!doctype html><meta charset="utf-8"><title>Form Studio body review</title><style>body{background:#161617;color:#eee;font:14px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{margin:0}img{width:100%}figcaption{padding:10px 0}</style><h1>Body revision 5 — render review</h1><main>${images.map((name) => `<figure><a href="${name}.png"><img src="${name}.png" loading="lazy"></a><figcaption>${name}</figcaption></figure>`).join("")}</main>`,
  );
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ images: images.length, errors }));
} finally {
  await browser.close();
}
