import { Unzlib } from "fflate";

/** Bounded inspection before handing untrusted image bytes to a browser decoder.
 * PNG: https://www.w3.org/TR/png-3/ ; Exif orientation: CIPA DC-008, tag 274.
 * This deliberately has no project/domain dependency so import and restore agree.
 */
export const RASTER_LIMITS = {
  edge: 8192,
  pixels: 32_000_000,
  bytes: 16_500_000,
} as const;
export type RasterHeader = {
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  encodedWidth: number;
  encodedHeight: number;
  orientation: number;
};

function damaged(detail: string): never {
  throw new Error(`Invalid or damaged image: ${detail}.`);
}
function dimensions(width: number, height: number, maxPixels: number) {
  if (!width || !height) damaged("missing dimensions");
  if (
    width > RASTER_LIMITS.edge ||
    height > RASTER_LIMITS.edge ||
    width * height > RASTER_LIMITS.pixels
  )
    throw new Error(
      "Use artwork up to 8192 pixels per side and 32 megapixels.",
    );
  if (!Number.isFinite(maxPixels) || width * height > maxPixels)
    throw new Error("This image exceeds the remaining project image budget.");
}
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc(bytes: Uint8Array, start: number, end: number) {
  let n = 0xffffffff;
  for (let i = start; i < end; i++)
    n = (n >>> 8) ^ crcTable[(n ^ bytes[i]) & 255];
  return (n ^ 0xffffffff) >>> 0;
}

/** Read only IFD0; all offsets stay inside this Exif segment, never image data. */
function exifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 8) damaged("truncated Exif header");
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  if (!little && !(bytes[0] === 0x4d && bytes[1] === 0x4d))
    damaged("Exif byte order");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(2, little) !== 42) damaged("Exif signature");
  const offset = view.getUint32(4, little);
  if (offset < 8 || offset + 2 > bytes.length) damaged("Exif directory offset");
  const count = view.getUint16(offset, little);
  if (offset + 2 + count * 12 + 4 > bytes.length)
    damaged("truncated Exif directory");
  let orientation = 1,
    seen = false;
  for (let i = 0; i < count; i++) {
    const p = offset + 2 + i * 12;
    if (view.getUint16(p, little) !== 0x112) continue;
    if (
      seen ||
      view.getUint16(p + 2, little) !== 3 ||
      view.getUint32(p + 4, little) !== 1
    )
      damaged("Exif orientation field");
    orientation = view.getUint16(p + 8, little);
    if (orientation < 1 || orientation > 8) damaged("Exif orientation value");
    seen = true;
  }
  return orientation;
}

function pngHeader(bytes: Uint8Array, maxPixels: number) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((b, i) => bytes[i] !== b))
    damaged("PNG signature or header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(8) !== 13 ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR"
  )
    damaged("missing PNG header");
  const width = view.getUint32(16),
    height = view.getUint32(20);
  dimensions(width, height, maxPixels);
  const depth = bytes[24],
    color = bytes[25];
  const validDepths: Record<number, number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  if (
    !validDepths[color]?.includes(depth) ||
    bytes[26] !== 0 ||
    bytes[27] !== 0 ||
    bytes[28] > 1
  )
    damaged("unsupported PNG header fields");
  let offset = 8,
    idatBytes = 0,
    ended = false,
    orientation = 1,
    palette = false,
    chunks = 0;
  while (offset + 12 <= bytes.length) {
    if (++chunks > 65_536) damaged("too many PNG chunks");
    const length = view.getUint32(offset),
      end = offset + 12 + length;
    if (end > bytes.length) damaged("truncated PNG chunk");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type) || (offset !== 8 && type === "IHDR"))
      damaged("PNG chunk header");
    if (["acTL", "fcTL", "fdAT"].includes(type))
      throw new Error(
        "Animated PNG artwork is not supported. Export a still PNG or JPEG.",
      );
    if (
      type[0] === type[0].toUpperCase() &&
      !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)
    )
      damaged("unknown critical PNG chunk");
    if (crc(bytes, offset + 4, end - 4) !== view.getUint32(end - 4))
      damaged("PNG checksum");
    if (type === "PLTE") {
      if (idatBytes || palette || length === 0 || length > 768 || length % 3)
        damaged("PNG palette");
      palette = true;
    }
    if (type === "IDAT") idatBytes += length;
    if (type === "eXIf")
      orientation = exifOrientation(bytes.subarray(offset + 8, end - 4));
    if (type === "IEND") {
      if (length || !idatBytes || end !== bytes.length) damaged("PNG ending");
      ended = true;
      break;
    }
    offset = end;
  }
  if (!ended || (color === 3 && !palette)) damaged("incomplete PNG");
  return { width, height, orientation };
}

function jpegHeader(bytes: Uint8Array, maxPixels: number) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    damaged("JPEG signature");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2,
    width = 0,
    height = 0,
    orientation = 1,
    scans = 0,
    markers = 0;
  while (offset < bytes.length) {
    if (++markers > 65_536) damaged("too many JPEG markers");
    if (bytes[offset++] !== 0xff) damaged("JPEG marker");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!width || !scans) damaged("incomplete JPEG");
      return { width, height, orientation };
    }
    if (
      marker === undefined ||
      marker === 0 ||
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      damaged("unexpected JPEG marker");
    if (marker === 0x01) continue;
    if (offset + 2 > bytes.length) damaged("truncated JPEG segment");
    const length = view.getUint16(offset),
      end = offset + length;
    if (length < 2 || end > bytes.length) damaged("truncated JPEG segment");
    // SOF0..SOF15, excluding Huffman table/JPEG extension/arithmetic table.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      if (width || length < 11) damaged("JPEG frame header");
      height = view.getUint16(offset + 3);
      width = view.getUint16(offset + 5);
      dimensions(width, height, maxPixels);
      const components = bytes[offset + 7];
      if (!components || components > 4 || length !== 8 + components * 3)
        damaged("JPEG frame components");
    }
    if (
      marker === 0xe1 &&
      length >= 8 &&
      String.fromCharCode(...bytes.subarray(offset + 2, offset + 8)) ===
        "Exif\0\0"
    )
      orientation = exifOrientation(bytes.subarray(offset + 8, end));
    offset = end;
    if (marker === 0xda) {
      if (!width || length < 8 || length !== 6 + bytes[end - length + 2] * 2)
        damaged("JPEG scan header");
      scans++;
      // Skip entropy bytes without decoding them. Stuffed FF00 and restart
      // markers belong to this scan; all other markers resume segment parsing.
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        let next = offset + 1;
        while (bytes[next] === 0xff) next++;
        if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) {
          offset = next + 1;
          continue;
        }
        break;
      }
    }
  }
  return damaged("missing JPEG end marker");
}

/** Browsers can resolve Image.decode() for an invalid PNG as a blank image.
 * Check its zlib stream ourselves, without allocating the full pixel buffer.
 * Small input pushes bound each inflate allocation; output is discarded after
 * length, filter and Adler-32 checks. Header budgets have already been applied.
 */
function validatePngPixels(bytes: Uint8Array, header: RasterHeader) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const bits = bytes[24] * channels[bytes[25]];
  const passes =
    bytes[28] === 0
      ? [[0, 0, 1, 1]]
      : [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ];
  const rows = passes
    .map(([x, y, dx, dy]) => ({
      width: Math.max(0, Math.ceil((header.encodedWidth - x) / dx)),
      count: Math.max(0, Math.ceil((header.encodedHeight - y) / dy)),
    }))
    .filter((p) => p.width && p.count)
    .map((p) => ({ bytes: Math.ceil((p.width * bits) / 8), count: p.count }));
  const expected = rows.reduce((n, p) => n + (p.bytes + 1) * p.count, 0);
  const streams: Uint8Array[] = [];
  let offset = 8,
    compressed = 0;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset);
    if (
      String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)) ===
        "IDAT" &&
      size
    ) {
      streams.push(bytes.subarray(offset + 8, offset + 8 + size));
      compressed += size;
    }
    offset += size + 12;
  }
  if (compressed < 6) damaged("truncated PNG compressed pixels");
  const trailer = new Uint8Array(4);
  let tail = 4;
  for (let i = streams.length - 1; i >= 0 && tail; i--) {
    const part = streams[i],
      n = Math.min(tail, part.length);
    tail -= n;
    trailer.set(part.subarray(part.length - n), tail);
  }
  const checksum = new DataView(trailer.buffer).getUint32(0);
  let total = 0,
    a = 1,
    b = 0,
    pass = 0,
    row = 0,
    remaining = 0;
  const stream = new Unzlib((output) => {
    total += output.length;
    if (total > expected) damaged("PNG pixels exceed the declared dimensions");
    for (let start = 0; start < output.length; start += 5552) {
      const end = Math.min(output.length, start + 5552);
      for (let i = start; i < end; i++) {
        a += output[i];
        b += a;
      }
      a %= 65521;
      b %= 65521;
    }
    let i = 0;
    while (i < output.length) {
      if (!remaining) {
        if (output[i++] > 4 || !rows[pass]) damaged("PNG scanline filter");
        remaining = rows[pass].bytes;
      }
      const n = Math.min(output.length - i, remaining);
      i += n;
      remaining -= n;
      if (!remaining) {
        row++;
        if (row === rows[pass].count) {
          pass++;
          row = 0;
        }
      }
    }
  });
  try {
    let pushed = 0;
    for (const part of streams) {
      for (let i = 0; i < part.length; i += 256) {
        const input = part.subarray(i, i + 256);
        pushed += input.length;
        stream.push(input, pushed === compressed);
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid or damaged image:")
    )
      throw error;
    damaged("PNG compressed pixels");
  }
  if (total !== expected || ((b << 16) | a) >>> 0 !== checksum)
    damaged("PNG pixel length or checksum");
}

export function inspectRasterHeader(
  bytes: Uint8Array,
  mime: string,
  maxPixels: number = RASTER_LIMITS.pixels,
): RasterHeader {
  if (bytes.length > RASTER_LIMITS.bytes)
    throw new Error("Image exceeds the 16.5 MB decoded-file limit.");
  if (mime !== "image/png" && mime !== "image/jpeg")
    damaged("use PNG or JPEG image bytes");
  const result =
    mime === "image/png"
      ? pngHeader(bytes, maxPixels)
      : jpegHeader(bytes, maxPixels);
  const rotated = result.orientation >= 5;
  return {
    mime,
    orientation: result.orientation,
    encodedWidth: result.width,
    encodedHeight: result.height,
    width: rotated ? result.height : result.width,
    height: rotated ? result.width : result.height,
  };
}

/** Node verifies framing, checksums and dimensions; browsers additionally decode
 * the bounded image. A valid header alone is never treated as decode success.
 */
export async function validateRasterPreview(
  data: string,
  expected?: { width: number; height: number },
  maxPixels: number = RASTER_LIMITS.pixels,
): Promise<RasterHeader> {
  if (data.length > Math.ceil(RASTER_LIMITS.bytes / 3) * 4 + 23)
    throw new Error("Image data exceeds the file limit.");
  const match =
    /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/.exec(data);
  if (!match || match[2].length % 4 || /=[A-Za-z0-9+/]/.test(match[2]))
    damaged("image MIME or base64 data");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    return damaged("image base64 data");
  }
  const header = inspectRasterHeader(bytes, match[1], maxPixels);
  // Older decoders may report pre-orientation dimensions. Only permit a swap
  // when the actual Exif orientation calls for it, never for ordinary images.
  const matches = (w: number, h: number) =>
    (w === header.width && h === header.height) ||
    (header.orientation >= 5 &&
      w === header.encodedWidth &&
      h === header.encodedHeight);
  if (expected && !matches(expected.width, expected.height))
    damaged("stored dimensions do not match image bytes");
  if (header.mime === "image/png") validatePngPixels(bytes, header);
  if (typeof Image !== "undefined") {
    const image = new Image();
    try {
      image.src = data;
      await image.decode();
      if (!matches(image.naturalWidth, image.naturalHeight))
        damaged("decoded dimensions do not match image header");
      return {
        ...header,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Invalid or damaged image:")
      )
        throw error;
      return damaged("image could not be decoded");
    } finally {
      image.src = "";
    }
  }
  return header;
}
