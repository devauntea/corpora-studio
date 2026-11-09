import { deflateSync } from "node:zlib";

export function pngChunk(type: string, payload: Uint8Array) {
  const data = Buffer.from(payload),
    chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const b of chunk.subarray(4, chunk.length - 4)) {
    crc ^= b;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return chunk;
}
/** Real grayscale PNGs, so project fixtures test image integrity, not fake bytes. */
export function rasterPng(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const pixels = Buffer.alloc((width + 1) * height, 255);
  for (let row = 0; row < height; row++) pixels[row * (width + 1)] = 0;
  return (
    "data:image/png;base64," +
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflateSync(pixels)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]).toString("base64")
  );
}

// A real 2x3 JPEG encoded once using Pillow. Tests need no image library.
export const jpegBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1WiiivPOs/9k=";
export function rotatedJpeg(orientation = 6, little = true) {
  const source = Buffer.from(jpegBase64, "base64"),
    tiff = Buffer.alloc(26);
  tiff.write(little ? "II" : "MM");
  const u16 = (v: number, p: number) =>
    little ? tiff.writeUInt16LE(v, p) : tiff.writeUInt16BE(v, p);
  const u32 = (v: number, p: number) =>
    little ? tiff.writeUInt32LE(v, p) : tiff.writeUInt32BE(v, p);
  u16(42, 2);
  u32(8, 4);
  u16(1, 8);
  u16(0x112, 10);
  u16(3, 12);
  u32(1, 14);
  u16(orientation, 18);
  const segment = Buffer.concat([
    Buffer.from([0xff, 0xe1, 0, 34]),
    Buffer.from("Exif\0\0"),
    tiff,
  ]);
  return (
    "data:image/jpeg;base64," +
    Buffer.concat([
      source.subarray(0, 2),
      segment,
      source.subarray(2),
    ]).toString("base64")
  );
}
