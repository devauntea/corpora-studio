import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

test("linked pose study edits one composition, retains guides and 4K intent after reopening", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("full-arm");
  await page.getByLabel("Body artwork detail").selectOption("left-arm");
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.locator(".canvas-host").getAttribute("data-chart-sizes")) ||
          "{}",
      ),
    )
    .toMatchObject({ "left-arm": 4096 });
  await page
    .getByRole("button", { name: "Pose & sleeve study", exact: true })
    .click();
  const study = page.getByRole("dialog", { name: "Tattoo composition study" });
  await expect(study.getByRole("status")).toContainText("cameras stay linked", {
    timeout: 90000,
  });
  await expect
    .poll(async () =>
      JSON.parse(
        (await page
          .getByTestId("flex-view")
          .getAttribute("data-rendered-body")) || "{}",
      ),
    )
    .toMatchObject({ armPose: { left: { flex: 90 } } });
  const before = await page
    .getByTestId("rest-view")
    .getAttribute("data-camera");
  const box = (await page.getByTestId("rest-view").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.getByTestId("rest-view")).not.toHaveAttribute(
    "data-camera",
    before!,
  );
  expect(await page.getByTestId("rest-view").getAttribute("data-camera")).toBe(
    await page.getByTestId("flex-view").getAttribute("data-camera"),
  );
  await study.getByLabel("Study tattoo width (mm)").fill("123");
  await study
    .getByLabel("Transfer pose", { exact: true })
    .selectOption("arm-bend");
  await study.getByRole("button", { name: "Add space band" }).click();
  await study.getByLabel("Guide height (%)").fill("52");
  await study.getByLabel("Guide name").fill("Elbow breathing room");
  await study.getByLabel("Linked camera").selectOption("three-quarter");
  await expect(study.getByRole("status")).toContainText("cameras stay linked", {
    timeout: 90000,
  });
  await expect(
    study.getByAltText("Unwrapped artwork planning overview"),
  ).toBeVisible();
  // Resizing an uploaded chart must reallocate its WebGL storage. A stale
  // allocation leaves three quarters of the UV map (and body) black.
  const corners = await study
    .getByAltText("Unwrapped artwork planning overview")
    .evaluate((img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return [
        [8, 8],
        [c.width - 8, 8],
        [8, c.height - 8],
        [c.width - 8, c.height - 8],
      ].map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data));
    });
  expect(
    corners.every(
      (p) => p[0] > 220 && p[1] > 220 && p[2] > 220 && p[3] === 255,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".tattoo-planning").analyze())
      .violations,
  ).toEqual([]);
  await study.screenshot({ path: info.outputPath("linked-pose-study.png") });
  const proof = page.waitForEvent("download");
  await study.getByRole("button", { name: "Export pose proof" }).click();
  await (await proof).saveAs(info.outputPath("pose-proof.png"));
  await study.getByRole("button", { name: "Close study" }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = info.outputPath("study.formstudio");
  await (await dl).saveAs(file);
  const p = JSON.parse(await fs.readFile(file, "utf8"));
  expect(p.version).toBe(19);
  expect(p.layers[0].width).toBe(123);
  expect(p.body.armPose?.left?.flex ?? 0).toBe(0);
  expect(p.tattooStudy).toMatchObject({
    transferPose: "arm-bend",
    detailZone: "left-arm",
    guides: [{ name: "Elbow breathing room", v: 0.52 }],
  });
  await page.getByLabel("Project file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Pose & sleeve study" }).click();
  await expect(page.getByLabel("Transfer pose", { exact: true })).toHaveValue(
    "arm-bend",
  );
  await expect(page.getByLabel("Planning guide").locator("option")).toHaveCount(
    2,
  );
  expect(errors).toEqual([]);
});
