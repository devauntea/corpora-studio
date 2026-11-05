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
declare module "@freesewing/aaron" {
  export { Teagan as Aaron } from "@freesewing/teagan";
}
declare module "@freesewing/albert" {
  export { Teagan as Albert } from "@freesewing/teagan";
}
declare module "@freesewing/ashley" {
  export { Teagan as Ashley } from "@freesewing/teagan";
}
declare module "@freesewing/bee" {
  export { Teagan as Bee } from "@freesewing/teagan";
}
declare module "@freesewing/bella" {
  export { Teagan as Bella } from "@freesewing/teagan";
}
declare module "@freesewing/bent" {
  export { Teagan as Bent } from "@freesewing/teagan";
}
declare module "@freesewing/bibi" {
  export { Teagan as Bibi } from "@freesewing/teagan";
}
declare module "@freesewing/bob" {
  export { Teagan as Bob } from "@freesewing/teagan";
}
declare module "@freesewing/breanna" {
  export { Teagan as Breanna } from "@freesewing/teagan";
}
declare module "@freesewing/bruce" {
  export { Teagan as Bruce } from "@freesewing/teagan";
}
declare module "@freesewing/carlita" {
  export { Teagan as Carlita } from "@freesewing/teagan";
}
declare module "@freesewing/carlton" {
  export { Teagan as Carlton } from "@freesewing/teagan";
}
declare module "@freesewing/cathrin" {
  export { Teagan as Cathrin } from "@freesewing/teagan";
}
declare module "@freesewing/charlie" {
  export { Teagan as Charlie } from "@freesewing/teagan";
}
declare module "@freesewing/cornelius" {
  export { Teagan as Cornelius } from "@freesewing/teagan";
}
declare module "@freesewing/crux" {
  export { Teagan as Crux } from "@freesewing/teagan";
}
declare module "@freesewing/devon" {
  export { Teagan as Devon } from "@freesewing/teagan";
}
declare module "@freesewing/diana" {
  export { Teagan as Diana } from "@freesewing/teagan";
}
declare module "@freesewing/florence" {
  export { Teagan as Florence } from "@freesewing/teagan";
}
declare module "@freesewing/florent" {
  export { Teagan as Florent } from "@freesewing/teagan";
}
declare module "@freesewing/hannah" {
  export { Teagan as Hannah } from "@freesewing/teagan";
}
declare module "@freesewing/holmes" {
  export { Teagan as Holmes } from "@freesewing/teagan";
}
declare module "@freesewing/hortensia" {
  export { Teagan as Hortensia } from "@freesewing/teagan";
}
declare module "@freesewing/huey" {
  export { Teagan as Huey } from "@freesewing/teagan";
}
declare module "@freesewing/hugo" {
  export { Teagan as Hugo } from "@freesewing/teagan";
}
declare module "@freesewing/jaeger" {
  export { Teagan as Jaeger } from "@freesewing/teagan";
}
declare module "@freesewing/jane" {
  export { Teagan as Jane } from "@freesewing/teagan";
}
declare module "@freesewing/jett" {
  export { Teagan as Jett } from "@freesewing/teagan";
}
declare module "@freesewing/lily" {
  export { Teagan as Lily } from "@freesewing/teagan";
}
declare module "@freesewing/lucy" {
  export { Teagan as Lucy } from "@freesewing/teagan";
}
declare module "@freesewing/lumina" {
  export { Teagan as Lumina } from "@freesewing/teagan";
}
declare module "@freesewing/lumira" {
  export { Teagan as Lumira } from "@freesewing/teagan";
}
declare module "@freesewing/lunetius" {
  export { Teagan as Lunetius } from "@freesewing/teagan";
}
declare module "@freesewing/noble" {
  export { Teagan as Noble } from "@freesewing/teagan";
}
declare module "@freesewing/onyx" {
  export { Teagan as Onyx } from "@freesewing/teagan";
}
declare module "@freesewing/opal" {
  export { Teagan as Opal } from "@freesewing/teagan";
}
declare module "@freesewing/otis" {
  export { Teagan as Otis } from "@freesewing/teagan";
}
declare module "@freesewing/paco" {
  export { Teagan as Paco } from "@freesewing/teagan";
}
declare module "@freesewing/penelope" {
  export { Teagan as Penelope } from "@freesewing/teagan";
}
declare module "@freesewing/percy" {
  export { Teagan as Percy } from "@freesewing/teagan";
}
declare module "@freesewing/sabrina" {
  export { Teagan as Sabrina } from "@freesewing/teagan";
}
declare module "@freesewing/sandy" {
  export { Teagan as Sandy } from "@freesewing/teagan";
}
declare module "@freesewing/sasha" {
  export { Teagan as Sasha } from "@freesewing/teagan";
}
declare module "@freesewing/shelly" {
  export { Teagan as Shelly } from "@freesewing/teagan";
}
declare module "@freesewing/shin" {
  export { Teagan as Shin } from "@freesewing/teagan";
}
declare module "@freesewing/simone" {
  export { Teagan as Simone } from "@freesewing/teagan";
}
declare module "@freesewing/sophie" {
  export { Teagan as Sophie } from "@freesewing/teagan";
}
declare module "@freesewing/sven" {
  export { Teagan as Sven } from "@freesewing/teagan";
}
declare module "@freesewing/tamiko" {
  export { Teagan as Tamiko } from "@freesewing/teagan";
}
declare module "@freesewing/tiberius" {
  export { Teagan as Tiberius } from "@freesewing/teagan";
}
declare module "@freesewing/tina" {
  export { Teagan as Tina } from "@freesewing/teagan";
}
declare module "@freesewing/toni" {
  export { Teagan as Toni } from "@freesewing/teagan";
}
declare module "@freesewing/trayvon" {
  export { Teagan as Trayvon } from "@freesewing/teagan";
}
declare module "@freesewing/tristan" {
  export { Teagan as Tristan } from "@freesewing/teagan";
}
declare module "@freesewing/uma" {
  export { Teagan as Uma } from "@freesewing/teagan";
}
declare module "@freesewing/umbra" {
  export { Teagan as Umbra } from "@freesewing/teagan";
}
declare module "@freesewing/wahid" {
  export { Teagan as Wahid } from "@freesewing/teagan";
}
declare module "@freesewing/walburga" {
  export { Teagan as Walburga } from "@freesewing/teagan";
}
declare module "@freesewing/waralee" {
  export { Teagan as Waralee } from "@freesewing/teagan";
}
declare module "@freesewing/yuri" {
  export { Teagan as Yuri } from "@freesewing/teagan";
}
