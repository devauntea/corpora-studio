import {
  clothDefaults,
  type ClothPanel,
  type ClothConfig,
} from "./cloth-model";
import type { PatternDraft } from "./fashion-model";
import { clothMesh, panelOutline } from "./cloth-mesh";
export function makePanel(pieceId: string, name: string): ClothPanel {
  return {
    id: crypto.randomUUID(),
    pieceId,
    name,
    unfold: false,
    mirror: false,
    x: 0,
    y: 300,
    z: 200,
    yaw: 0,
    roll: 0,
    pinTop: true,
  };
}
export function bodiceSetup(inputDraft: PatternDraft): ClothConfig {
  const front = inputDraft.pieces.find((p) => p.id === "front"),
    back = inputDraft.pieces.find((p) => p.id === "back");
  if (!front || !back)
    throw new Error("The bodice starter needs front and back pieces.");
  const a = {
      ...makePanel(front.id, "Front"),
      unfold: /fold/i.test(front.cut),
    },
    b = {
      ...makePanel(back.id, "Back"),
      unfold: /fold/i.test(back.cut),
      z: -200,
      yaw: 180,
      mirror: true,
    };
  const next = {
    ...clothDefaults(),
    mode: "garment" as const,
    panels: [a, b],
  };
  const built = clothMesh(inputDraft, next),
    stitches: ClothConfig["stitches"] = [];
  // Identify long side seams by geometric location. Neck, armholes and hem remain open.
  for (const sign of [-1, 1]) {
    const ranges = [a, b].map((panel, j) => {
      const outline = panelOutline(j ? back : front, panel.unfold),
        xs = outline.map((p) => p.x),
        ys = outline.map((p) => p.y),
        cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        top = Math.min(...ys),
        height = Math.max(...ys) - top,
        loop = built.panels[j],
        ids = loop.boundary.filter((i) => {
          const x = built.rest[i * 3] - cx,
            y = built.rest[i * 3 + 1] - top;
          return x * sign > 30 && y > height * 0.38 && y < height * 0.96;
        });
      const fs = ids.map((i) => loop.fractions[loop.boundary.indexOf(i)]);
      const from = Math.min(...fs),
        to = Math.max(...fs);
      const first = ids[fs.indexOf(from)],
        last = ids[fs.indexOf(to)];
      return {
        panel: panel.id,
        from,
        to,
        direction: built.rest[last * 3 + 1] - built.rest[first * 3 + 1],
      };
    });
    if (ranges.every((r) => Number.isFinite(r.from) && r.to > r.from))
      stitches.push({
        id: crypto.randomUUID(),
        a: { panel: ranges[0].panel, from: ranges[0].from, to: ranges[0].to },
        b: { panel: ranges[1].panel, from: ranges[1].from, to: ranges[1].to },
        reverse: ranges[0].direction * ranges[1].direction < 0,
      });
  }
  return { ...next, stitches };
}
