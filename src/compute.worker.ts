/// <reference lib="webworker" />
import type { ClothInput } from "./cloth-model";
import { fitBody, type FitInput } from "./body-fitting";
import { exponentialMap, type SurfaceMapInput } from "./surface-map";
import { preparePixels } from "./pixel-preparation";
import { traceStencil } from "./stencil-trace";
import type { ArtworkEdits } from "./domain";
self.onmessage = async (
  event: MessageEvent<
    | {
        kind: "artwork" | "trace";
        pixels: Uint8ClampedArray;
        width: number;
        height: number;
        edits?: ArtworkEdits;
        threshold?: number;
      }
    | ({ kind: "surface" } & SurfaceMapInput)
    | ({ kind: "body-fit" } & FitInput)
    | ({ kind: "cloth" } & ClothInput)
    | { kind: "archive"; files: Record<string, Uint8Array> }
  >,
) => {
  const d = event.data,
    progress = (value: number) => self.postMessage({ type: "progress", value });
  try {
    if (d.kind === "artwork") {
      const result = preparePixels(
        d.pixels,
        d.width,
        d.height,
        d.edits!,
        progress,
      );
      self.postMessage(
        { type: "result", result },
        { transfer: [result.pixels.buffer, result.alpha.buffer] },
      );
    } else if (d.kind === "trace")
      self.postMessage({
        type: "result",
        result: traceStencil(
          d.pixels,
          d.width,
          d.height,
          d.threshold,
          progress,
        ),
      });
    else if (d.kind === "surface") {
      const result = exponentialMap(d, progress);
      self.postMessage(
        { type: "result", result },
        { transfer: [result.coordinates.buffer, result.distance.buffer] },
      );
    } else if (d.kind === "body-fit")
      self.postMessage({ type: "result", result: fitBody(d, progress) });
    else if (d.kind === "cloth") {
      const { simulateCloth } = await import("./cloth-solver");
      const result = simulateCloth(d, progress);
      self.postMessage(
        { type: "result", result },
        { transfer: [result.positions.buffer] },
      );
    } else if (d.kind === "archive") {
      const entries = Object.entries(d.files);
      if (
        entries.length > 40 ||
        entries.reduce((s, [, v]) => s + v.length, 0) > 50000000 ||
        entries.some(([k]) => k.includes("..") || k.startsWith("/"))
      )
        throw new Error("Portfolio archive exceeds its safe file budget.");
      const { zipSync } = await import("fflate");
      const result = zipSync(d.files, { level: 1 });
      self.postMessage(
        { type: "result", result },
        { transfer: [result.buffer] },
      );
    } else throw new Error("Unknown local job.");
  } catch (e) {
    self.postMessage({
      type: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
