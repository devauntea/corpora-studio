import { test, expect } from "@playwright/test";

test("muscle filter changes pixels, zero opacity restores skin, and hover identifies the chest", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Body model", exact: true }).click();
  await page.getByLabel("Body region").selectOption("upper-body");
  const ready = async (values: Record<string, unknown>) => {
    await expect
      .poll(async () =>
        JSON.parse(
          (await page
            .locator(".canvas-host")
            .getAttribute("data-rendered-body")) || "{}",
        ),
      )
      .toMatchObject(values);
  };
  await ready({ section: "upper-body", anatomy: false });
  await page.getByRole("button", { name: "front", exact: true }).click();
  const canvas = page.locator(".canvas-host canvas");
  const pixels = () =>
    canvas.evaluate((element) =>
      (element as HTMLCanvasElement).toDataURL("image/png"),
    );
  const skin = await pixels();
  await page.getByRole("button", { name: "Muscles", exact: true }).click();
  await ready({ anatomy: true });
  await canvas.screenshot({ path: info.outputPath("colored-filter.png") });
  expect(await pixels()).not.toBe(skin);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.43, box.y + box.height * 0.32);
  await expect(page.locator(".anatomy-caption")).toContainText(
    "Pectoralis major",
  );
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .fill("0");
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .press("Enter");
  await ready({ anatomy: true, model: { anatomyOpacity: 0 } });
  expect(await pixels()).toBe(skin);
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "Anatomy filter opacity" })
    .press("Enter");
  await ready({ anatomy: true, model: { anatomyOpacity: 1 } });
  await page.getByRole("button", { name: "Skin", exact: true }).click();
  await ready({ anatomy: false });
  expect(await pixels()).toBe(skin);
  expect(errors).toEqual([]);
});
