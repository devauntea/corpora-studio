import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  blankProject,
  humanBody,
  parseProject,
  ProjectSchema,
} from "../src/domain";
import {
  emptyStudy,
  emptyTransferPlan,
  studyProject,
  TattooStudySchema,
  TransferPlanSchema,
  availableStudyPoses,
} from "../src/tattoo-study";
import {
  transferSections,
  registeredStencilPdf,
} from "../src/transfer-sections";
import { stencilDimensions, type StencilSettings } from "../src/stencil-export";
import * as THREE from "three";
import { muscleCorrector } from "../src/pose-correctives";
import { decodeRig } from "../src/skeleton";
import { musclePoseArms } from "../src/muscle-pose";

test("v13 migration retains the exact body and rejects v14 planning fields under the old version", async () => {
  const body = humanBody("upper-body");
  body.model!.revision = 5;
  const old = { ...blankProject(), version: 13, body };
  expect(await parseProject(JSON.stringify(old))).toEqual({
    ...old,
    version: 19,
  });
  await expect(
    parseProject(JSON.stringify({ ...old, tattooStudy: emptyStudy() })),
  ).rejects.toThrow("version 13");
  await expect(
    parseProject(JSON.stringify({ ...old, body: humanBody("upper-body") })),
  ).rejects.toThrow("version 13");
});
test("pose studies share authoritative artwork and never mutate their saved body", () => {
  const p = {
    ...blankProject(),
    body: humanBody("full-body"),
    tattooStudy: emptyStudy(),
  };
  const original = JSON.stringify(p),
    flex = studyProject(p, "double-biceps", 0.7),
    rest = studyProject(flex, "relaxed", 0.7);
  expect(flex.layers).toBe(p.layers);
  expect(flex.assets).toBe(p.assets);
  expect(flex.body).toMatchObject({
    musclePose: "double-biceps",
    armPose: { left: { flex: 105, raise: 78 } },
    muscleTension: 0.7,
  });
  expect(rest.body).toMatchObject({
    musclePose: "relaxed",
    armPose: { left: { flex: 0, raise: 0 } },
  });
  expect(JSON.stringify(p)).toBe(original);
  expect(availableStudyPoses(humanBody("full-leg"))).toEqual([
    "relaxed",
    "knee-bend",
  ]);
  expect(
    studyProject({ ...p, body: humanBody("full-leg") }, "double-biceps", 1)
      .body,
  ).toMatchObject({ musclePose: "relaxed" });
});
test("planning data round-trips and rejects unbounded or orphaned records", async () => {
  const p = {
    ...blankProject(),
    body: humanBody("full-arm"),
    tattooStudy: emptyStudy(),
  };
  expect(await parseProject(JSON.stringify(p))).toEqual(p);
  const plan = emptyTransferPlan();
  expect(
    ProjectSchema.safeParse({
      ...p,
      tattooStudy: {
        ...p.tattooStudy,
        stencils: [{ assetId: crypto.randomUUID(), plan }],
      },
    }).success,
  ).toBe(false);
  const section = {
    id: crypto.randomUUID(),
    name: "A",
    x: 0.8,
    y: 0,
    width: 0.4,
    height: 0.5,
  };
  expect(
    TransferPlanSchema.safeParse({ ...plan, sections: [section] }).success,
  ).toBe(false);
  expect(
    TattooStudySchema.safeParse({ ...emptyStudy(), tension: NaN }).success,
  ).toBe(false);
});
const settings: StencilSettings = {
  width: 100,
  lineWeight: 0.3,
  dpi: 300,
  mirror: false,
  paper: "a4",
  printer: {
    name: "Fixture profile",
    measuredX: 49,
    measuredY: 51,
    paper: "fixture",
    settings: "100%",
  },
};
test("adjacent sections share the same registration mark and exact nominal overlap before printer correction", () => {
  const plan = {
    ...emptyTransferPlan(),
    sections: [
      {
        id: crypto.randomUUID(),
        name: "Upper",
        x: 0,
        y: 0,
        width: 1,
        height: 0.5,
      },
      {
        id: crypto.randomUUID(),
        name: "Lower",
        x: 0,
        y: 0.5,
        width: 1,
        height: 0.5,
      },
    ],
    marks: [{ id: crypto.randomUUID(), name: "Shared", x: 0.3, y: 0.5 }],
  };
  const sections = transferSections(100, 200, settings, plan);
  expect(sections[0].y + sections[0].height - sections[1].y).toBe(5);
  expect(sections.map((s) => s.marks[0])).toEqual([
    expect.objectContaining({ x: 30, y: 100 }),
    expect.objectContaining({ x: 30, y: 100 }),
  ]);
  const mirrored = transferSections(
    100,
    200,
    { ...settings, mirror: true },
    plan,
  );
  expect(mirrored[0].marks[0]).toMatchObject({ x: 70, y: 100 });
  const d = stencilDimensions(100, 200, settings);
  expect(d.sx).toBe(50 / 49);
  expect(d.sy).toBe(50 / 51);
});
test("registered PDF includes proof plus section pages and bounds the output job", async () => {
  const plan = {
    ...emptyTransferPlan(),
    sections: [
      {
        id: crypto.randomUUID(),
        name: "Upper",
        x: 0,
        y: 0,
        width: 1,
        height: 0.5,
      },
      {
        id: crypto.randomUUID(),
        name: "Lower",
        x: 0,
        y: 0.5,
        width: 1,
        height: 0.5,
      },
    ],
  };
  const lines = [
    {
      id: 0,
      length: 200,
      points: [
        [0, 0],
        [100, 200],
      ] as [number, number][],
    },
  ];
  const pdf = await registeredStencilPdf(lines, 100, 200, settings, plan);
  const text = new TextDecoder().decode(pdf);
  expect(text.startsWith("%PDF-")).toBe(true);
  expect(text).toMatch(/\/Count 3\b/);
  await expect(
    registeredStencilPdf(
      lines,
      100,
      200,
      { ...settings, width: 600 },
      {
        ...plan,
        sections: Array.from({ length: 12 }, (_, i) => ({
          id: crypto.randomUUID(),
          name: String(i),
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        })),
      },
    ),
  ).rejects.toThrow("48 stencil pages");
});
for (const sex of ["male", "female"] as const)
  test(`${sex} revision 6 preserves topology/weights and flex orientation across both builds`, async () => {
    const root = new URL("../public/anatomy/", import.meta.url),
      meta = JSON.parse(
        await readFile(new URL(`human-v6-${sex}.json`, root), "utf8"),
      );
    const old = await readFile(new URL(`human-v5-${sex}.bin`, root)),
      next = await readFile(new URL(meta.buffer, root)),
      n = meta.vertexCount;
    expect(next.subarray(n * 48).equals(old.subarray(n * 48))).toBe(true);
    expect(
      (await readFile(new URL(`muscle-field-v6-${sex}.bin`, root))).equals(
        await readFile(new URL(`muscle-field-v5-${sex}.bin`, root)),
      ),
    ).toBe(true);
    const float = (b: Buffer) =>
      new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + n * 48));
    const a = float(old),
      b = float(next),
      indices = new Uint32Array(
        next.buffer.slice(
          next.byteOffset + n * 48,
          next.byteOffset + next.length,
        ),
      );
    for (let i = 0; i < n; i++)
      for (let j = 6; j < 12; j++) expect(a[i * 12 + j]).toBe(b[i * 12 + j]);
    const rigMeta = JSON.parse(
      await readFile(new URL(`rig-v6-${sex}.json`, root), "utf8"),
    );
    const rigBytes = await readFile(new URL(rigMeta.buffer, root));
    const rig = decodeRig(
      rigMeta,
      rigBytes.buffer.slice(
        rigBytes.byteOffset,
        rigBytes.byteOffset + rigBytes.byteLength,
      ),
      n,
    );
    for(let i=0;i<n;i++) for(let c=0;c<3;c++) expect(rig.chartRest[i*3+c]).toBe(a[i*12+c]);
    const influences = new Uint8Array(
      await readFile(new URL(`muscle-field-v6-${sex}.bin`, root)),
    ).subarray(n * 4);
    const body = humanBody("full-body");
    body.model!.sex = sex;
    const cross = (a: number[], b: number[], c: number[]) => {
      const u = b.map((v, k) => v - a[k]),
        v = c.map((v, k) => v - a[k]);
      return [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
    };
    for (const muscularity of [0, 1]) {
      const rest = Array.from({ length: n }, (_, i) =>
        [0, 1, 2].map((k) => b[i * 12 + k] + muscularity * b[i * 12 + k + 3]),
      );
      for (const musclePose of [
        "chest-flex",
        "back-flex",
        "double-biceps",
      ] as const) {
        const correct = muscleCorrector(rig, influences, {
          ...body,
          muscularity,
          musclePose,
          muscleTension: 1,
          armPose: musclePoseArms(musclePose),
        });
        const posed = rest.map((p, i) =>
          correct(
            new THREE.Vector3(...(p as [number, number, number])),
            i,
          ).toArray(),
        );
        let inverted = 0;
        for (let i = 0; i < indices.length; i += 3) {
          const ids = [indices[i], indices[i + 1], indices[i + 2]],
            r = cross(rest[ids[0]], rest[ids[1]], rest[ids[2]]),
            q = cross(posed[ids[0]], posed[ids[1]], posed[ids[2]]);
          if (
            Math.hypot(...r) > 1e-9 &&
            r.reduce((s, v, k) => s + v * q[k], 0) <= 0
          )
            inverted++;
        }
        expect(inverted).toBe(0);
      }
    }
  }, 60000);

test("PDF contour positions use corrected millimetres and matching registration positions on adjoining sections", async () => {
  const { inflateSync } = await import("node:zlib");
  const { stencilPdf } = await import("../src/stencil-export");
  const lines = [
    {
      id: 0,
      length: 100,
      points: [
        [0, 0],
        [100, 100],
      ] as [number, number][],
    },
  ];
  const plan = {
    ...emptyTransferPlan(),
    sections: [
      {
        id: crypto.randomUUID(),
        name: "Top",
        x: 0,
        y: 0,
        width: 1,
        height: 0.5,
      },
      {
        id: crypto.randomUUID(),
        name: "Bottom",
        x: 0,
        y: 0.5,
        width: 1,
        height: 0.5,
      },
    ],
    marks: [{ id: crypto.randomUUID(), name: "JOIN", x: 0.3, y: 0.5 }],
  };
  const streams = (pdf: Uint8Array) =>
    [
      ...Buffer.from(pdf)
        .toString("latin1")
        .matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g),
    ].map((m) => inflateSync(Buffer.from(m[1], "latin1")).toString());
  const moves = (s: string) =>
    [...s.matchAll(/([-\d.]+) ([-\d.]+) m\b/g)].map((m) => [
      (Number(m[1]) * 25.4) / 72,
      297 - (Number(m[2]) * 25.4) / 72,
    ]);
  const pages = streams(
    await registeredStencilPdf(lines, 100, 200, settings, plan),
  );
  expect(moves(pages[1])[0][0]).toBeCloseTo(12, 3);
  expect(moves(pages[1])[0][1]).toBeCloseTo(24, 3);
  // The same global mark is near the lower edge of Top and upper edge of Bottom.
  expect(moves(pages[1])[1][0]).toBeCloseTo(12 + (28 * 50) / 49, 3);
  expect(moves(pages[1])[1][1]).toBeCloseTo(24 + (100 * 50) / 51, 3);
  expect(moves(pages[2])[1][1]).toBeCloseTo(24 + (2.5 * 50) / 51, 3);
  const old = streams(await stencilPdf(lines, 100, 200, settings));
  expect(moves(old[0])[0][0]).toBeCloseTo(12, 3);
  expect(moves(old[0])[0][1]).toBeCloseTo(18, 3);
  expect(() => stencilDimensions(NaN, 100, settings)).toThrow();
});

test("long transfer notes and full printer settings survive PDF pagination", async () => {
  const { inflateSync } = await import("node:zlib");
  const { printerProfileKey } = await import("../src/stencil-export");
  const notes = "Keep seam marks aligned. ".repeat(38) + "FINAL LANDMARK";
  const printer = {
    ...settings.printer,
    paper: "Transfer stock ".repeat(6),
    settings: "Driver configuration ".repeat(7) + "FINAL SETTING",
  };
  const pdf = await registeredStencilPdf(
    [
      {
        id: 0,
        length: 100,
        points: [
          [0, 0],
          [100, 100],
        ],
      },
    ],
    100,
    100,
    { ...settings, printer },
    { ...emptyTransferPlan(), notes },
  );
  const text = Buffer.from(pdf).toString("latin1");
  expect(text).toMatch(/\/Count 3\b/);
  const decoded = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((m) => inflateSync(Buffer.from(m[1], "latin1")).toString())
    .join(" ");
  expect(decoded).toContain("FINAL LANDMARK");
  expect(decoded).toContain("FINAL SETTING");
  expect(printerProfileKey(printer)).not.toBe(
    printerProfileKey({ ...printer, paper: "Other stock" }),
  );
  expect(printerProfileKey(printer)).not.toBe(
    printerProfileKey({ ...printer, settings: "Other setting" }),
  );
  if (process.env.FORM_STUDIO_QA_EXPORT) {
    const fs = await import("node:fs/promises");
    await fs.mkdir("qa/body-014/pdf-review", { recursive: true });
    await fs.writeFile("qa/body-014/pdf-review/long-notes.pdf", pdf);
  }
});
