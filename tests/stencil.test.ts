import { test, expect } from "vitest";
import { traceStencil } from "../src/stencil-trace";
import {
  stencilDimensions,
  stencilPdf,
  calibrationPdf,
  withPngDpi,
} from "../src/stencil-export";
import { preparePixels } from "../src/pixel-preparation";
import { cleanArtwork } from "../src/domain";
test("skeleton preserves a closed loop and open branching lines", () => {
  const w = 64,
    h = 64,
    p = new Uint8ClampedArray(w * h * 4).fill(255);
  const ink = (x: number, y: number) => {
    p[(y * w + x) * 4] = p[(y * w + x) * 4 + 1] = p[(y * w + x) * 4 + 2] = 0;
  };
  for (let x = 10; x <= 50; x++) {
    ink(x, 10);
    ink(x, 50);
  }
  for (let y = 10; y <= 50; y++) {
    ink(10, y);
    ink(50, y);
  }
  const paths = traceStencil(p, w, h);
  expect(paths.length).toBe(1);
  expect(paths[0].points[0]).toEqual(paths[0].points.at(-1));
  expect(paths[0].length).toBe(160);
});
test("physical correction, PDF signatures and image job limits", async () => {
  const s = {
    width: 100,
    lineWeight: 0.3,
    dpi: 300 as const,
    mirror: false,
    paper: "a4" as const,
    printer: { name: "Test", measuredX: 49, measuredY: 51 },
  };
  const d = stencilDimensions(100, 200, s);
  expect((d.width * 49) / 50).toBeCloseTo(100);
  expect((d.height * 51) / 50).toBeCloseTo(200);
  const bytes = await stencilPdf(
    [
      {
        id: 0,
        length: 100,
        points: [
          [0, 0],
          [100, 100],
        ],
      },
    ],
    100,
    100,
    s,
  );
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect((await calibrationPdf("a4")).length).toBeGreaterThan(1000);
  expect(() =>
    preparePixels(new Uint8ClampedArray(4), 5000, 5000, cleanArtwork()),
  ).toThrow(/budget/);
});
test("PNG output has one valid physical pixel size chunk", () => {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const out = withPngDpi(withPngDpi(png, 150), 300),
    text = Buffer.from(out).toString("latin1");
  expect(text.split("pHYs").length - 1).toBe(1);
  const index = text.indexOf("pHYs"),
    view = new DataView(out.buffer);
  expect(view.getUint32(index + 4)).toBe(11811);
  expect(out[index + 12]).toBe(1);
});
