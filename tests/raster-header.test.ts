import { afterEach, describe, expect, test, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  inspectRasterHeader,
  validateRasterPreview,
} from "../src/raster-header";
import { blankProject, parseProject, sha256 } from "../src/domain";
import {
  jpegBase64,
  pngChunk,
  rasterPng,
  rotatedJpeg,
} from "./raster-fixtures";

afterEach(() => vi.unstubAllGlobals());
const bytes = (url: string) => Buffer.from(url.split(",")[1], "base64");
const pngUrl = (data: Uint8Array) =>
  "data:image/png;base64," + Buffer.from(data).toString("base64");
function pngWithDimensions(width: number, height: number) {
  const png = bytes(rasterPng(1, 1)),
    header = Buffer.from(png.subarray(16, 29));
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  return pngUrl(
    Buffer.concat([
      png.subarray(0, 8),
      pngChunk("IHDR", header),
      png.subarray(33),
    ]),
  );
}
function decoder(width: number, height: number, failure = false) {
  const decode = vi.fn(async () => {
    if (failure) throw new Error("EncodingError");
  });
  const create = vi.fn(function (this: Record<string, unknown>) {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.decode = decode;
    this.src = "";
  });
  vi.stubGlobal("Image", create);
  return { create, decode };
}

describe("bounded image preflight", () => {
  test("reads genuine PNG and JPEG dimensions without a DOM", async () => {
    expect(
      await validateRasterPreview(rasterPng(100, 200), {
        width: 100,
        height: 200,
      }),
    ).toMatchObject({ width: 100, height: 200, mime: "image/png" });
    expect(
      inspectRasterHeader(Buffer.from(jpegBase64, "base64"), "image/jpeg"),
    ).toMatchObject({ width: 2, height: 3 });
  });
  test.each([
    [9000, 1],
    [1, 9000],
    [8000, 8000],
  ])(
    "rejects tiny compressed PNG with oversized %d x %d header before allocating decoder",
    async (w, h) => {
      const mock = decoder(w, h),
        data = pngWithDimensions(w, h);
      expect(data.length).toBeLessThan(200);
      await expect(validateRasterPreview(data)).rejects.toThrow(
        /8192.*32 megapixels/,
      );
      expect(mock.create).not.toHaveBeenCalled();
    },
  );
  test("rejects JPEG oversized frame before decoding", async () => {
    const jpeg = Buffer.from(jpegBase64, "base64"),
      sof = jpeg.indexOf(Buffer.from([255, 192]));
    jpeg.writeUInt16BE(6000, sof + 5);
    jpeg.writeUInt16BE(6000, sof + 7);
    const mock = decoder(6000, 6000);
    await expect(
      validateRasterPreview(
        "data:image/jpeg;base64," + jpeg.toString("base64"),
      ),
    ).rejects.toThrow(/32 megapixels/);
    expect(mock.create).not.toHaveBeenCalled();
  });
  test("enforces remaining project pixels before decoding", async () => {
    const mock = decoder(100, 200);
    await expect(
      validateRasterPreview(rasterPng(100, 200), undefined, 19_999),
    ).rejects.toThrow(/remaining project/);
    expect(mock.create).not.toHaveBeenCalled();
  });
  test.each(["acTL", "fcTL", "fdAT"])(
    "rejects animation chunk %s before decoder allocation",
    async (type) => {
      const png = bytes(rasterPng(2, 3)),
        mock = decoder(2, 3);
      const animated = pngUrl(
        Buffer.concat([
          png.subarray(0, 33),
          pngChunk(type, Buffer.alloc(8)),
          png.subarray(33),
        ]),
      );
      await expect(validateRasterPreview(animated)).rejects.toThrow(
        /Animated PNG/,
      );
      expect(mock.create).not.toHaveBeenCalled();
    },
  );
  test("rejects forged MIME, fake file, malformed base64, truncated headers and invalid checksums", async () => {
    const png = rasterPng(20, 30),
      jpeg = Buffer.from(jpegBase64, "base64");
    for (const data of [
      png.replace("image/png", "image/jpeg"),
      "data:image/png;base64,aW1hZ2UtZml4dHVyZQ==",
      "data:image/png;base64,a===",
      pngUrl(bytes(png).subarray(0, 25)),
      "data:image/jpeg;base64," + jpeg.subarray(0, 190).toString("base64"),
    ])
      await expect(validateRasterPreview(data)).rejects.toThrow(
        /Invalid or damaged/,
      );
    const corrupt = bytes(png);
    corrupt[29] ^= 1;
    await expect(validateRasterPreview(pngUrl(corrupt))).rejects.toThrow(
      /checksum/,
    );
  });
  test("metadata mismatch fails before decode; successful decode also must match the header", async () => {
    const mock = decoder(20, 30);
    await expect(
      validateRasterPreview(rasterPng(20, 30), { width: 30, height: 20 }),
    ).rejects.toThrow(/stored dimensions/);
    expect(mock.create).not.toHaveBeenCalled();
    decoder(10, 10);
    await expect(validateRasterPreview(rasterPng(20, 30))).rejects.toThrow(
      /decoded dimensions/,
    );
  });
  test("rejects corrupt pixel compression even when browsers would resolve decode with a blank fallback", async () => {
    const png = bytes(rasterPng(2, 3));
    const data = pngUrl(
      Buffer.concat([
        png.subarray(0, 33),
        pngChunk("IDAT", Buffer.from([0, 1, 2, 3])),
        pngChunk("IEND", Buffer.alloc(0)),
      ]),
    );
    // This is structurally valid; inspection does not pretend to decompress pixels.
    expect(inspectRasterHeader(bytes(data), "image/png")).toMatchObject({
      width: 2,
      height: 3,
    });
    const mock = decoder(2, 3);
    await expect(validateRasterPreview(data)).rejects.toThrow(
      /PNG compressed pixels/,
    );
    expect(mock.create).not.toHaveBeenCalled();
  });
  test("bounded streaming inflate rejects dishonest small PNG headers, bad pixel lengths and bad Adler checksums", async () => {
    const png = bytes(rasterPng(1, 1)),
      mock = decoder(1, 1);
    const wrap = (raw: Uint8Array) =>
      pngUrl(
        Buffer.concat([
          png.subarray(0, 33),
          pngChunk("IDAT", raw),
          pngChunk("IEND", Buffer.alloc(0)),
        ]),
      );
    // 10 MB inflation behind a 1x1 header: rejected after the first bounded
    // compressed input push, without allocating a full uncompressed buffer.
    const bomb = wrap(deflateSync(Buffer.alloc(10_000_000)));
    expect(bomb.length).toBeLessThan(20_000);
    await expect(validateRasterPreview(bomb)).rejects.toThrow(
      /exceed the declared dimensions/,
    );
    await expect(
      validateRasterPreview(wrap(deflateSync(Buffer.from([0])))),
    ).rejects.toThrow(/pixel length/);
    const corrupt = deflateSync(Buffer.from([0, 0]));
    corrupt[corrupt.length - 1] ^= 1;
    await expect(validateRasterPreview(wrap(corrupt))).rejects.toThrow(
      /checksum/,
    );
    expect(mock.create).not.toHaveBeenCalled();
  });
  test("accepts the complete Adam7 pass layout for a real interlaced PNG", async () => {
    const original = bytes(rasterPng(5, 5)),
      header = Buffer.from(original.subarray(16, 29));
    header[12] = 1;
    // 5x5 grayscale: 2+2+3+4+4+9+12 bytes including pass scanline filters.
    const data = pngUrl(
      Buffer.concat([
        original.subarray(0, 8),
        pngChunk("IHDR", header),
        pngChunk("IDAT", deflateSync(Buffer.alloc(36))),
        pngChunk("IEND", Buffer.alloc(0)),
      ]),
    );
    expect(await validateRasterPreview(data)).toMatchObject({
      width: 5,
      height: 5,
    });
  });
  test("requires browser decode success after structural preflight", async () => {
    const mock = decoder(2, 3, true);
    await expect(
      validateRasterPreview("data:image/jpeg;base64," + jpegBase64),
    ).rejects.toThrow(/could not be decoded/);
    expect(mock.decode).toHaveBeenCalledOnce();
  });
  test.each([true, false])(
    "handles Exif byte order and orientations (little endian %s)",
    async (little) => {
      for (let orientation = 1; orientation <= 8; orientation++) {
        const width = orientation >= 5 ? 3 : 2,
          height = orientation >= 5 ? 2 : 3;
        const data = rotatedJpeg(orientation, little);
        expect(
          await validateRasterPreview(data, { width, height }),
        ).toMatchObject({
          width,
          height,
          orientation,
          encodedWidth: 2,
          encodedHeight: 3,
        });
      }
    },
  );
  test("accepts a browser's orientation-adjusted dimensions; no untagged arbitrary swaps", async () => {
    decoder(3, 2);
    expect(
      await validateRasterPreview(rotatedJpeg(), { width: 3, height: 2 }),
    ).toMatchObject({ width: 3, height: 2 });
    await expect(
      validateRasterPreview("data:image/jpeg;base64," + jpegBase64, {
        width: 3,
        height: 2,
      }),
    ).rejects.toThrow(/stored dimensions/);
    decoder(2, 3);
    expect(
      await validateRasterPreview(rotatedJpeg(), { width: 2, height: 3 }),
    ).toMatchObject({ width: 2, height: 3 });
  });
});

test("project restore rejects correctly hashed fake PNG and metadata mismatch, including HEIC previews", async () => {
  const project = blankProject(),
    data = rasterPng(20, 30);
  const asset = {
    id: crypto.randomUUID(),
    name: "Image",
    mime: "image/png" as const,
    data,
    sha256: await sha256(data),
    width: 20,
    height: 30,
  };
  project.assets = [asset];
  expect(await parseProject(JSON.stringify(project))).toEqual(project);
  project.assets[0] = { ...asset, width: 21 };
  await expect(parseProject(JSON.stringify(project))).rejects.toThrow(
    /stored dimensions/,
  );
  const fake = "data:image/png;base64,aW1hZ2UtZml4dHVyZQ==";
  project.assets[0] = { ...asset, data: fake, sha256: await sha256(fake) };
  await expect(parseProject(JSON.stringify(project))).rejects.toThrow(
    /Invalid or damaged/,
  );
  const heic = "data:image/heic;base64,aGVpYw==";
  project.assets[0] = {
    ...asset,
    mime: "image/heic",
    data: heic,
    sha256: await sha256(heic),
    preview: data,
    previewSha256: await sha256(data),
  };
  expect(await parseProject(JSON.stringify(project))).toEqual(project);
  project.assets[0].height = 31;
  await expect(parseProject(JSON.stringify(project))).rejects.toThrow(
    /stored dimensions/,
  );
});
