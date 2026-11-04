import type { ClothInput, ClothResult } from "./cloth-model";
import type { ArtworkEdits } from "./domain";
import type { FitInput, fitBody } from "./body-fitting";
import type { SurfaceMapInput, SurfaceMapResult } from "./surface-map";
import type { Contour } from "./stencil-trace";
type ImageInput = {
  kind: "artwork" | "trace";
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  edits?: ArtworkEdits;
  threshold?: number;
};
type Input =
  | ImageInput
  | ({ kind: "surface" } & SurfaceMapInput)
  | ({ kind: "body-fit" } & FitInput)
  | ({ kind: "cloth" } & ClothInput)
  | { kind: "archive"; files: Record<string, Uint8Array> };
type Options = { signal?: AbortSignal; progress?: (value: number) => void };
let active = 0;
const queue: (() => void)[] = [];
function pump() {
  while (active < 2 && queue.length) {
    active++;
    queue.shift()!();
  }
}
function run<T>(input: Input, options: Options = {}): Promise<T> {
  if (
    ("width" in input && input.width * input.height > 8_400_000) ||
    queue.length >= 24
  )
    return Promise.reject(new Error("Local compute resource limit reached."));
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined,
      started = false,
      done = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: unknown, result?: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker?.terminate();
      options.signal?.removeEventListener("abort", abort);
      if (started) active--;
      else {
        const i = queue.indexOf(start);
        if (i >= 0) queue.splice(i, 1);
      }
      error ? reject(error) : resolve(result!);
      pump();
    };
    const abort = () =>
      finish(new DOMException("Local job cancelled", "AbortError"));
    const start = () => {
      started = true;
      try {
        worker = new Worker(new URL("./compute.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = (e) => {
          if (e.data.type === "progress") options.progress?.(e.data.value);
          else if (e.data.type === "error") finish(new Error(e.data.error));
          else finish(undefined, e.data.result as T);
        };
        worker.onerror = (e) =>
          finish(new Error(e.message || "Local worker failed."));
        timer = setTimeout(
          () =>
            finish(
              new Error(
                "Local job exceeded 60 seconds. Reduce the image size or detail.",
              ),
            ),
          60000,
        );
        worker.postMessage(
          input,
          "files" in input
            ? Object.values(input.files).map((f) => f.buffer)
            : "mesh" in input
              ? [
                  input.mesh.positions.buffer,
                  input.mesh.rest.buffer,
                  input.mesh.indices.buffer,
                  input.mesh.pins.buffer,
                  input.mesh.stitches.buffer,
                  input.mesh.colors.buffer,
                  input.bodyPositions.buffer,
                  input.bodyIndices.buffer,
                ]
              : "pixels" in input
                ? [input.pixels.buffer]
                : "positions" in input
                  ? [input.positions.buffer, input.indices.buffer]
                  : [
                      input.vertices.buffer,
                      input.indices.buffer,
                      ...(input.armGates ? [input.armGates.buffer] : []),
                    ],
        );
      } catch (e) {
        finish(e);
      }
    };
    if (options.signal?.aborted) {
      reject(new DOMException("Local job cancelled", "AbortError"));
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    queue.push(start);
    options.progress?.(0);
    pump();
  });
}
export const prepareInWorker = (
  input: Omit<ImageInput, "kind">,
  options?: Options,
) =>
  run<{ pixels: Uint8ClampedArray; alpha: Uint8ClampedArray }>(
    { ...input, kind: "artwork" },
    options,
  );
export const traceInWorker = (
  input: Omit<ImageInput, "kind">,
  options?: Options,
) => run<Contour[]>({ ...input, kind: "trace" }, options);

export const mapSurfaceInWorker = (input: SurfaceMapInput, options?: Options) =>
  run<SurfaceMapResult>({ ...input, kind: "surface" }, options);

export const fitBodyInWorker = (input: FitInput, options?: Options) =>
  run<ReturnType<typeof fitBody>>({ ...input, kind: "body-fit" }, options);

export const clothInWorker = (input: ClothInput, options?: Options) =>
  run<ClothResult>({ ...input, kind: "cloth" }, options);

export const archiveInWorker = (
  files: Record<string, Uint8Array>,
  options?: Options,
) => run<Uint8Array>({ kind: "archive", files }, options);
