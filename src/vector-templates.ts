import {
  newVectorPack,
  mapLayer,
  type VectorLayer,
  type VectorNode,
  type VectorPack,
  type VectorView,
} from "./vector-pack";
export const flatTemplates = [
  "T-shirt",
  "Tank top",
  "Sweatshirt",
  "Hoodie",
  "Shirt",
  "Jacket",
  "Waistcoat",
  "Trousers",
  "Shorts",
  "Skirt",
  "Dress",
  "Jumpsuit",
] as const;
export type FlatTemplate = (typeof flatTemplates)[number];
const nodes = (points: number[][]): VectorNode[] =>
  points.map(([x, y, ix, iy, ox, oy]) => ({
    x,
    y,
    ...(ix !== undefined ? { in: { x: ix, y: iy } } : {}),
    ...(ox !== undefined ? { out: { x: ox, y: oy } } : {}),
  }));
export function vectorLayer(
  name: string,
  view: VectorView,
  points: number[][],
  closed = true,
  fill = "#f0eee9",
): VectorLayer {
  return {
    id: crypto.randomUUID(),
    name,
    view,
    nodes: nodes(points),
    closed,
    fill,
    stroke: "#202020",
    strokeWidth: 1.6,
    dashed: false,
    visible: true,
    locked: false,
    material: "",
  };
}
export const componentNames = [
  "Patch pocket",
  "Welt pocket",
  "Collar",
  "Cuff",
  "Button",
  "Zipper",
  "Topstitch",
  "Label",
] as const;
export function vectorComponent(
  name: (typeof componentNames)[number],
  view: VectorView,
): VectorLayer {
  const shapes: Record<typeof name, number[][]> = {
    "Patch pocket": [
      [200, 240],
      [260, 240],
      [260, 290],
      [230, 310],
      [200, 290],
    ],
    "Welt pocket": [
      [190, 255],
      [270, 255],
      [270, 267],
      [190, 267],
    ],
    Collar: [
      [200, 140],
      [220, 165],
      [240, 140],
      [260, 155],
      [240, 185],
      [220, 168],
      [200, 185],
      [180, 155],
    ],
    Cuff: [
      [190, 280],
      [270, 280],
      [270, 305],
      [190, 305],
    ],
    Button: [
      [225, 260, 225, 257, 228, 260],
      [230, 265, 230, 262, 230, 268],
      [225, 270, 228, 270, 222, 270],
      [220, 265, 220, 268, 220, 262],
    ],
    Zipper: [
      [225, 190],
      [225, 390],
    ],
    Topstitch: [
      [170, 400],
      [290, 400],
    ],
    Label: [
      [200, 220],
      [250, 220],
      [250, 242],
      [200, 242],
    ],
  };
  const l = vectorLayer(
    name,
    view,
    shapes[name],
    !["Zipper", "Topstitch"].includes(name),
  );
  if (name === "Topstitch") {
    l.dashed = true;
    l.fill = "none";
    l.strokeWidth = 0.8;
  }
  if (name === "Zipper") {
    l.dashed = true;
    l.strokeWidth = 4;
    l.fill = "none";
  }
  return l;
}
export function templateLayers(kind: FlatTemplate): VectorLayer[] {
  const result: VectorLayer[] = [];
  for (const view of ["front", "back"] as const) {
    const add = (
      name: string,
      pts: number[][],
      closed = true,
      fill = "#f0eee9",
    ) => {
      const l = vectorLayer(name, view, pts, closed, fill);
      result.push(l);
      return l;
    };
    const seam = (name: string, pts: number[][]) => {
      const l = add(name, pts, false, "none");
      l.dashed = true;
      l.strokeWidth = 0.8;
      return l;
    };
    const back = view === "back";
    if (["Trousers", "Shorts"].includes(kind)) {
      const hem = kind === "Shorts" ? 365 : 540;
      add("Shell", [
        [145, 120],
        [295, 120],
        [310, 230, 306, 166],
        [300, hem],
        [237, hem],
        [220, 290],
        [203, hem],
        [140, hem],
        [130, 230, 132, 170],
      ]);
      add("Waistband", [
        [145, 120],
        [295, 120],
        [299, 143],
        [141, 143],
      ]);
      seam("Center seam", [
        [220, 143],
        [220, 290],
      ]);
      seam("Hem stitch left", [
        [140, hem - 10],
        [202, hem - 10],
      ]);
      seam("Hem stitch right", [
        [238, hem - 10],
        [300, hem - 10],
      ]);
      if (!back) {
        seam("Fly", [
          [233, 145],
          [233, 225],
          [220, 236, 233, 236],
        ]);
        seam("Left pocket opening", [
          [146, 146],
          [135, 213, 142, 190],
        ]);
        seam("Right pocket opening", [
          [294, 146],
          [305, 213, 298, 190],
        ]);
      } else {
        add("Left back pocket", [
          [153, 177],
          [198, 177],
          [196, 220],
          [175, 231],
          [153, 220],
        ]);
        add("Right back pocket", [
          [242, 177],
          [287, 177],
          [287, 220],
          [265, 231],
          [244, 220],
        ]);
      }
    } else if (kind === "Skirt") {
      add("Shell", [
        [153, 140],
        [287, 140],
        [330, 500, 310, 340],
        [110, 500],
        [153, 140, 130, 340],
      ]);
      add("Waistband", [
        [153, 140],
        [287, 140],
        [291, 162],
        [149, 162],
      ]);
      seam("Hem stitch", [
        [112, 489],
        [328, 489],
      ]);
      seam("Dart left", [
        [172, 164],
        [180, 224],
        [185, 164],
      ]);
      seam("Dart right", [
        [255, 164],
        [260, 224],
        [268, 164],
      ]);
      if (back)
        seam("Center back / zip", [
          [220, 163],
          [220, 500],
        ]);
    } else if (kind === "Waistcoat") {
      const outline = back
        ? [
            [186, 110],
            [254, 110, 220, 125],
            [290, 130],
            [275, 220, 262, 178],
            [280, 340],
            [270, 390],
            [170, 390],
            [160, 340],
            [165, 220],
            [150, 130, 178, 178],
          ]
        : [
            [186, 110],
            [220, 218],
            [254, 110],
            [290, 130],
            [275, 220, 262, 178],
            [280, 340],
            [263, 397],
            [232, 410],
            [220, 390],
            [208, 410],
            [177, 397],
            [160, 340],
            [165, 220],
            [150, 130, 178, 178],
          ];
      add("Shell", outline);
      if (back) {
        seam("Center back", [
          [220, 125],
          [220, 390],
        ]);
        add(
          "Back adjustment belt",
          [
            [172, 305],
            [266, 305],
            [266, 318],
            [172, 318],
          ],
          true,
          "#dedbd4",
        );
        add(
          "Buckle",
          [
            [214, 301],
            [230, 301],
            [230, 322],
            [214, 322],
          ],
          true,
          "none",
        );
      } else {
        add(
          "Button stand",
          [
            [216, 218],
            [224, 218],
            [224, 390],
            [216, 390],
          ],
          true,
          "#dedbd4",
        );
        for (let y = 242; y < 385; y += 35) {
          const b = vectorComponent("Button", view);
          result.push(mapLayer(b, (p) => ({ x: p.x - 5, y: p.y - 265 + y })));
        }
        add("Left welt pocket", [
          [177, 303],
          [207, 298],
          [208, 308],
          [178, 313],
        ]);
        add("Right welt pocket", [
          [233, 298],
          [263, 303],
          [262, 313],
          [232, 308],
        ]);
        seam("Left waist dart", [
          [185, 227],
          [195, 280],
          [188, 338],
        ]);
        seam("Right waist dart", [
          [255, 227],
          [245, 280],
          [252, 338],
        ]);
      }
    } else {
      const tank =
        kind === "Tank top" || kind === "Dress" || kind === "Jumpsuit";
      const long = ["Sweatshirt", "Hoodie", "Shirt", "Jacket"].includes(kind);
      const neckY = back ? 112 : 145;
      const outline = tank
        ? [
            [190, 105],
            [250, 105, 220, neckY],
            [280, 118],
            [280, 218, 268, 184],
            [290, 420],
            [150, 420],
            [160, 218],
            [160, 118, 173, 184],
          ]
        : [
            [188, 105],
            [252, 105, 228, neckY],
            [295, 123],
            [long ? 355 : 340, long ? 350 : 194],
            [long ? 320 : 300, long ? 366 : 215],
            [280, 206],
            [290, 420],
            [150, 420],
            [160, 206],
            [long ? 120 : 140, long ? 366 : 215],
            [long ? 85 : 100, long ? 350 : 194],
            [145, 123],
          ];
      if (kind === "Dress") {
        outline[4] = [340, 540];
        outline[5] = [100, 540];
      }
      if (kind === "Jumpsuit") {
        outline.splice(
          4,
          2,
          [300, 300],
          [294, 545],
          [235, 545],
          [220, 355],
          [205, 545],
          [146, 545],
          [140, 300],
        );
      }
      add("Shell", outline);
      if (!["Waistcoat", "Hoodie", "Shirt", "Jacket"].includes(kind))
        add(
          "Neck binding",
          [
            [188, 105],
            [252, 105, 228, neckY],
            [257, 111],
            [183, 111, 220, neckY + 12],
          ],
          true,
          "#dedbd4",
        );
      if (long) {
        add(
          "Left cuff",
          [
            [85, 350],
            [120, 366],
            [113, 383],
            [79, 365],
          ],
          true,
          "#dedbd4",
        );
        add(
          "Right cuff",
          [
            [320, 366],
            [355, 350],
            [361, 365],
            [327, 383],
          ],
          true,
          "#dedbd4",
        );
      }
      if (kind === "Hoodie") {
        add(
          "Hood",
          [
            [188, 111],
            [183, 72, 168, 85],
            [220, 48, 191, 45],
            [257, 72, 248, 45],
            [252, 111, 274, 85],
            [220, 149, 243, 145],
          ],
          true,
          "#e4e0d8",
        );
        if (!back) {
          add("Kangaroo pocket", [
            [177, 295],
            [263, 295],
            [280, 354],
            [273, 377],
            [167, 377],
            [160, 354],
          ]);
          seam("Pocket stitch", [
            [177, 305],
            [263, 305],
          ]);
          add(
            "Drawstring left",
            [
              [208, 148],
              [204, 228],
            ],
            false,
            "none",
          );
          add(
            "Drawstring right",
            [
              [232, 148],
              [236, 228],
            ],
            false,
            "none",
          );
        }
      }
      if (["Shirt", "Jacket", "Waistcoat"].includes(kind)) {
        if (!back) {
          add(
            "Placket",
            [
              [216, 154],
              [224, 154],
              [224, 420],
              [216, 420],
            ],
            true,
            "#dedbd4",
          );
          add("Collar", [
            [188, 105],
            [220, 140],
            [252, 105],
            [262, 135],
            [238, 164],
            [220, 142],
            [202, 164],
            [178, 135],
          ]);
          for (let y = 190; y < 410; y += 42) {
            const b = vectorComponent("Button", view);
            b.nodes = b.nodes.map((n) => ({
              ...n,
              x: n.x - 5,
              y: n.y - 265 + y,
              in: n.in ? { x: n.in.x - 5, y: n.in.y - 265 + y } : undefined,
              out: n.out ? { x: n.out.x - 5, y: n.out.y - 265 + y } : undefined,
            }));
            result.push(b);
          }
          add("Chest pocket", [
            [244, 210],
            [274, 210],
            [273, 248],
            [258, 259],
            [244, 248],
          ]);
        } else
          seam("Back yoke", [
            [150, 165],
            [290, 165],
          ]);
      }
      if (kind === "Jacket") {
        if (!back) {
          add("Left cargo pocket", [
            [167, 303],
            [208, 303],
            [208, 365],
            [167, 365],
          ]);
          add("Right cargo pocket", [
            [232, 303],
            [273, 303],
            [273, 365],
            [232, 365],
          ]);
          add(
            "Left pocket flap",
            [
              [165, 300],
              [210, 300],
              [210, 315],
              [188, 322],
              [165, 315],
            ],
            true,
            "#dedbd4",
          );
          add(
            "Right pocket flap",
            [
              [230, 300],
              [275, 300],
              [275, 315],
              [253, 322],
              [230, 315],
            ],
            true,
            "#dedbd4",
          );
        } else {
          seam("Left back panel", [
            [180, 165],
            [176, 420],
          ]);
          seam("Right back panel", [
            [260, 165],
            [264, 420],
          ]);
        }
        add(
          "Hem facing",
          [
            [150, 402],
            [290, 402],
            [290, 420],
            [150, 420],
          ],
          true,
          "#dedbd4",
        );
      }
      if (kind === "Sweatshirt")
        add(
          "Rib hem",
          [
            [150, 399],
            [290, 399],
            [290, 420],
            [150, 420],
          ],
          true,
          "#dedbd4",
        );
      if (kind === "Hoodie") {
        if (!back)
          add(
            "Hood opening",
            [
              [197, 114],
              [192, 87, 183, 101],
              [220, 64, 202, 62],
              [248, 87, 242, 62],
              [243, 114, 256, 101],
              [220, 137, 238, 135],
            ],
            true,
            "#c6c1b7",
          );
        else
          seam("Hood center seam", [
            [220, 51],
            [220, 147],
          ]);
      }
      if (long || kind === "T-shirt") {
        seam("Left sleeve join", [
          [145, 123],
          [160, 206, 151, 174],
        ]);
        seam("Right sleeve join", [
          [295, 123],
          [280, 206, 289, 174],
        ]);
      }
      if (kind === "Dress") {
        seam("Waist seam", [
          [149, 286],
          [291, 286],
        ]);
        seam("Left bodice dart", [
          [180, 207],
          [188, 277],
          [196, 207],
        ]);
        seam("Right bodice dart", [
          [244, 207],
          [252, 277],
          [260, 207],
        ]);
      }
      if (kind === "Jumpsuit") {
        add(
          "Waistband",
          [
            [146, 283],
            [294, 283],
            [300, 300],
            [140, 300],
          ],
          true,
          "#dedbd4",
        );
        seam("Left pocket", [
          [155, 300],
          [145, 342],
        ]);
        seam("Right pocket", [
          [285, 300],
          [295, 342],
        ]);
        if (back)
          seam("Center back closure", [
            [220, 121],
            [220, 300],
          ]);
      }
      const hem = kind === "Dress" ? 528 : kind === "Jumpsuit" ? 533 : 409;
      if (kind !== "Jumpsuit")
        seam("Hem stitch", [
          [kind === "Dress" ? 104 : 151, hem],
          [kind === "Dress" ? 336 : 289, hem],
        ]);
    }
  }
  if (
    ["T-shirt", "Tank top", "Sweatshirt", "Hoodie", "Shirt", "Jacket"].includes(
      kind,
    )
  )
    return result.map((l) =>
      mapLayer(l, (p) => ({
        x: 220 + (p.x - 220) * (kind === "Jacket" ? 1.25 : 1.15),
        y: 105 + (p.y - 105) * 0.9,
      })),
    );
  return result;
}
export function templatePack(kind: FlatTemplate): VectorPack {
  return {
    ...newVectorPack(),
    name: kind,
    layers: templateLayers(kind),
    materials: [
      {
        id: crypto.randomUUID(),
        code: "FAB-01",
        kind: "Fabric",
        description: "Main shell — specify fabric",
        composition: "",
        color: "",
        quantity: 0,
        unit: "m",
        supplier: "",
      },
    ],
    measurements: [
      "Chest / hip width",
      "Body / outseam length",
      "Hem opening",
    ].map((name) => ({
      id: crypto.randomUUID(),
      name,
      method: "Measured flat; define landmarks",
      tolerance: 0.5,
      values: [null, null, null],
    })),
  };
}
