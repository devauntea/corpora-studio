declare module "@freesewing/teagan" {
  import type { PatternOp, Point2 } from "./fashion-model";
  type Path = {
    ops: PatternOp[];
    bbox(): { topLeft: Point2; bottomRight: Point2 };
    length(): number;
  };
  type Part = {
    paths: Record<string, Path>;
    points: Record<string, Point2>;
    snippets: Record<string, { def: string; anchor: Point2 }>;
  };
  export class Teagan {
    constructor(settings: Record<string, unknown>);
    draft(): this;
    parts: Record<string, Part>[];
    setStores: {
      logs: { error: unknown[]; warn: unknown[] };
      get(key: string): unknown;
    }[];
  }
}
