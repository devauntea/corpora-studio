import { test, expect } from "@playwright/test";

test("3D canvas fits after repeated Fashion switches and window resizing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const canvas = page.locator(".canvas-host canvas");
  await expect(canvas).toBeVisible();
  for (const width of [1280, 1600, 1100, 1440]) {
    await page.getByRole("button", { name: "Fashion", exact: true }).click();
    await expect(canvas).not.toBeVisible();
    await page.setViewportSize({ width, height: 940 });
    await page.getByRole("button", { name: "Tattoo", exact: true }).click();
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () =>
        canvas.evaluate((element) => {
          const host = element.parentElement!.getBoundingClientRect();
          const view = element.getBoundingClientRect();
          const ratio = Math.min(devicePixelRatio, 2);
          const drawing = element as HTMLCanvasElement;
          return (
            Math.abs(host.width - view.width) < 1 &&
            Math.abs(host.height - view.height) < 1 &&
            Math.abs(drawing.width - host.width * ratio) <= 1 &&
            Math.abs(drawing.height - host.height * ratio) <= 1
          );
        }),
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
});
