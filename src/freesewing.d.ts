declare module "@freesewing/teagan" {
  import type { PatternOp, Point2 } from "./fashion-model";
  type Path = {
    ops: PatternOp[];
    bbox(): { topLeft: Point2; bottomRight: Point2 };
    length(): number;
    hidden?: boolean;
    attributes?: { list?: { class?: string[] } };
    clone(): Path;
    join(p: Path): Path;
    close(): Path;
  };
  type Part = {
    hidden?: boolean;
    paths: Record<string, Path>;
    points: Record<string, Point2>;
    snippets: Record<string, { def: string; anchor: Point2 }>;
  };
  export class Teagan {
    constructor(settings: Record<string, unknown>);
    draft(): this;
    getConfig(): { measurements: string[]; options: Record<string, unknown> };
    parts: Record<string, Part>[];
    setStores: {
      logs: { error: unknown[]; warn: unknown[] };
      get(key: string): unknown;
    }[];
  }
}

declare module "@freesewing/brian" {
  export { Teagan as Brian } from "@freesewing/teagan";
}
declare module "@freesewing/titan" {
  export { Teagan as Titan } from "@freesewing/teagan";
}
declare module "@freesewing/sarah" {
  export { Teagan as Sarah } from "@freesewing/teagan";
}
declare module "@freesewing/simon" {
  export { Teagan as Simon } from "@freesewing/teagan";
}
