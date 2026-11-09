import { expect, test } from "@playwright/test";
import { pngChunk, rasterPng, rotatedJpeg } from "../raster-fixtures";

test("real browser decoding checks file content and preserves rotated JPEG dimensions", async ({
  page,
}) => {
  const valid = rasterPng(20, 30),
    bytes = Buffer.from(valid.split(",")[1], "base64");
  const broken =
    "data:image/png;base64," +
    Buffer.concat([
      bytes.subarray(0, 33),
      pngChunk("IDAT", Buffer.from([0, 1, 2, 3])),
      pngChunk("IEND", Buffer.alloc(0)),
    ]).toString("base64");
  await page.goto("/");
  const result = await page.evaluate(
    async ({ valid, broken, jpeg }) => {
      const rasterModule = "/src/raster-header.ts";
      const ioModule = "/src/io.ts";
      const { validateRasterPreview } = await import(rasterModule);
      const { assetFromFile } = await import(ioModule);
      const png = await validateRasterPreview(valid, { width: 20, height: 30 });
      const rotated = await validateRasterPreview(jpeg, {
        width: 3,
        height: 2,
      });
      let corruptError = "",
        budgetError = "";
      try {
        await validateRasterPreview(broken);
      } catch (error) {
        corruptError = String(error);
      }
      const file = new File(
        [Uint8Array.from(atob(valid.split(",")[1]), (c) => c.charCodeAt(0))],
        "actual.png",
        { type: "image/png" },
      );
      const asset = await assetFromFile(file);
      const Original = window.Image;
      let creations = 0;
      try {
        window.Image = class extends Original {
          constructor() {
            super();
            creations++;
          }
        };
        try {
          await assetFromFile(file, 599);
        } catch (error) {
          budgetError = String(error);
        }
      } finally {
        window.Image = Original;
      }
      return {
        png: [png.width, png.height],
        rotated: [rotated.width, rotated.height],
        asset: [asset.width, asset.height],
        corruptError,
        budgetError,
        creations,
      };
    },
    { valid, broken, jpeg: rotatedJpeg() },
  );
  expect(result.png).toEqual([20, 30]);
  expect(result.rotated).toEqual([3, 2]);
  expect(result.asset).toEqual([20, 30]);
  expect(result.corruptError).toContain("PNG compressed pixels");
  expect(result.budgetError).toContain("remaining project");
  expect(result.creations).toBe(0);
});
