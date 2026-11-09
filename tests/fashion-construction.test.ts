import { test, expect } from "vitest";
import {
  newFashion,
  lowerBodySample,
  catalogSample,
  FashionSchema,
} from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";
import {
  boundaryEdges,
  checkSeam,
  starterSeams,
  walkSide,
  withSeamNotches,
} from "../src/seam-checks";
import {
  detachPiece,
  constructPiece,
  splitSegment,
  removeAnchor,
} from "../src/pattern-geometry";
import { constructionArchive } from "../src/construction-export";
import {
  captureRevision,
  createSample,
  emptyDevelopment,
  revisionChanges,
  sampleRows,
  drawingHash,
} from "../src/style-development";
import { templatePack } from "../src/vector-templates";
import {
  VectorPackSchema,
  parseVectorPack,
  convertPackUnits,
} from "../src/vector-pack";
import { vectorPreflight } from "../src/vector-preflight";
import { vectorArchive, samplesCsv } from "../src/vector-export";
import { blankProject, parseProject, ProjectSchema } from "../src/domain";
import { unzipSync, strFromU8 } from "fflate";

for (const design of ["teagan", "simon", "titan"] as const)
  test(`${design} construction starter follows named edges and redrafts without losing seam identities`, () => {
    const f = {
        ...newFashion(),
        design,
        measurements: {
          ...newFashion().measurements,
          ...lowerBodySample,
          ...catalogSample,
        },
      },
      d = draftFashion(f),
      plan = starterSeams(d, design);
    expect(plan.seams.length).toBe(design === "teagan" ? 3 : 2);
    expect(plan.steps.length).toBe(4);
    for (const seam of plan.seams) {
      const c = checkSeam(d, seam);
      expect(c.a?.length).toBeGreaterThan(30);
      expect(c.b?.length).toBeGreaterThan(30);
      expect(c.issues.join(" ")).not.toMatch(
        /Missing|Reconnect|consecutive|cross or overlap/,
      );
    }
    const changed = draftFashion({
      ...f,
      measurements: { ...f.measurements, chest: 1050, seat: 1080 },
    });
    for (const seam of plan.seams) {
      expect(walkSide(changed, seam.a).length).toBeGreaterThan(30);
      expect(walkSide(changed, seam.b).length).toBeGreaterThan(30);
    }
    expect(FashionSchema.safeParse({ ...f, seamPlan: plan }).success).toBe(
      true,
    );
  });

test("seam walking uses curve arc length, preserves sewing direction, and reports out-of-range and nonconsecutive marks", () => {
  const d = draftFashion(newFashion()),
    plan = starterSeams(d, "teagan"),
    seam = plan.seams[0],
    base = checkSeam(d, seam);
  expect(base.a).toBeDefined();
  const reverse = walkSide(d, { ...seam.a, reverse: true });
  expect(reverse.at(0)).toEqual(base.a!.at(base.a!.length));
  expect(reverse.length).toBeCloseTo(base.a!.length, 6);
  const bad = {
    ...seam,
    notches: [{ ...seam.notches[0], a: base.a!.length + 20 }],
  };
  expect(checkSeam(d, bad).issues.join(" ")).toContain("outside");
  expect(
    checkSeam(d, { ...seam, ease: 15, tolerance: 1 }).issues.join(" "),
  ).toContain("nonzero intended ease");
  const e = boundaryEdges(d.pieces[0]);
  expect(() => walkSide(d, { ...seam.a, edges: [e[0].id, e[3].id] })).toThrow(
    "consecutive",
  );
  const ref = structuredClone(plan);
  expect(
    withSeamNotches(d, { ...newFashion(), seamPlan: plan }).pieces[0].notches
      .length,
  ).toBeGreaterThan(d.pieces[0].notches.length);
  expect(plan).toEqual(ref);
});

test("detaching preserves seam IDs, splitting/removing invalidates only affected edges instead of rebinding", () => {
  const d = draftFashion(newFashion()),
    seam = starterSeams(d, "teagan").seams[0],
    front = d.pieces[0],
    manual = detachPiece(front, 10);
  const replaced = {
    ...d,
    pieces: [constructPiece(front.id, manual), ...d.pieces.slice(1)],
  };
  expect(checkSeam(replaced, seam).a?.length).toBeCloseTo(
    checkSeam(d, seam).a!.length,
    5,
  );
  const split = splitSegment(manual, 2);
  const invalid = {
    ...d,
    pieces: [constructPiece(front.id, split), ...d.pieces.slice(1)],
  };
  expect(checkSeam(invalid, seam).issues.join(" ")).toContain("Reconnect");
  const untouched = boundaryEdges(front).find((e) => e.index === 5)!;
  expect(split.edgeIds).toContain(untouched.id);
  const removed = removeAnchor(manual, 2);
  expect(removed.edgeIds).not.toContain(manual.edgeIds![2]);
  expect(removed.edgeIds).not.toContain(manual.edgeIds![3]);
});

test("cubic arc length agrees with a dense independent numerical reference", () => {
  const d = draftFashion(newFashion()),
    p = d.pieces[0],
    e = boundaryEdges(p).find((e) => p.seam[e.index].type === "curve")!,
    o = p.seam[e.index];
  if (o.type !== "curve") throw Error();
  const prev = p.seam[e.index - 1];
  if (prev.type === "close") throw Error();
  let last = prev.to,
    total = 0;
  for (let i = 1; i <= 100000; i++) {
    const t = i / 100000,
      u = 1 - t,
      next = {
        x:
          u * u * u * prev.to.x +
          3 * u * u * t * o.cp1.x +
          3 * u * t * t * o.cp2.x +
          t * t * t * o.to.x,
        y:
          u * u * u * prev.to.y +
          3 * u * u * t * o.cp1.y +
          3 * u * t * t * o.cp2.y +
          t * t * t * o.to.y,
      };
    total += Math.hypot(next.x - last.x, next.y - last.y);
    last = next;
  }
  expect(Math.abs(total - e.length)).toBeLessThan(0.02);
});

test("construction ZIP uses current mm geometry, paired notches and verifiable file hashes", async () => {
  const f = newFashion(),
    draft = draftFashion(f);
  f.seamPlan = starterSeams(draft, "teagan");
  const files = unzipSync(await constructionArchive(draft, f, "Test style"));
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(strFromU8(files["cutting-pattern.svg"])).toMatch(/width="[\d.]+mm"/);
  const data = JSON.parse(strFromU8(files["construction.json"]));
  expect(data.plan).toEqual(f.seamPlan);
  expect(data.pieces[0].notches.length).toBeGreaterThan(
    draft.pieces[0].notches.length,
  );
  expect(manifest).toMatchObject({
    units: "mm",
    externalCadVerified: false,
    physicalSampleVerified: false,
  });
  for (const file of manifest.files) {
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", new Uint8Array(files[file.file])),
      ),
    ]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    expect(file.sha256).toBe(hash);
  }
});

test("samples keep frozen requested values and units through later specification edits, resize and export", async () => {
  const p = templatePack("T-shirt");
  p.measurements[0].values = [50, 52, 54];
  p.measurements[0].tolerance = 0.5;
  p.measurements[0].toleranceConfirmed = true;
  const revision = await captureRevision(p, "Proto A", "First specification"),
    sample = createSample(revision, "M", "Fit sample");
  sample.measurements[0].value = 53;
  p.development = {
    ...emptyDevelopment(),
    revisions: [revision],
    samples: [sample],
  };
  p.measurements[0].values[1] = 56;
  const converted = convertPackUnits(p, "in"),
    rows = sampleRows(converted.development!.revisions[0], sample);
  expect(rows[0]).toMatchObject({
    requested: 52,
    actual: 53,
    delta: 1,
    status: "Outside tolerance",
  });
  expect(converted.development!.revisions[0].spec.units).toBe("cm");
  expect(revisionChanges(p, revision)).toContain(
    "measurements: Chest / hip width changed",
  );
  expect(vectorPreflight(p).some((i) => i.code === "revision-changed")).toBe(
    true,
  );
  expect(VectorPackSchema.safeParse(converted).success).toBe(true);
  expect(samplesCsv(converted)).toContain(
    '"cm","Chest / hip width","52","53","1","0.5","Outside tolerance"',
  );
  const files = unzipSync(vectorArchive(converted));
  expect(
    JSON.parse(strFromU8(files["handoff-manifest.json"])).recordedRevisions[0]
      .revision,
  ).toBe("A");
  expect(strFromU8(files["tech-pack.pdf"])).toContain("Requested: 52");
});

test("unconfirmed tolerances cannot turn sample values into a pass; deleted linked records appear in preflight", async () => {
  const p = templatePack("T-shirt");
  p.measurements[0].values = [50, 50, 50];
  const r = await captureRevision(p, "Draft", ""),
    s = createSample(r, "M", "Sample");
  s.measurements[0].value = 50;
  expect(sampleRows(r, s)[0].status).toBe("Tolerance not confirmed");
  p.callouts = [
    {
      id: crypto.randomUUID(),
      view: "front",
      anchor: { x: 20, y: 20 },
      label: { x: 30, y: 30 },
      text: "Pocket",
      materialId: crypto.randomUUID(),
      layerId: crypto.randomUUID(),
      measurementId: crypto.randomUUID(),
    },
  ];
  expect(
    vectorPreflight(p).filter(
      (i) => i.code.startsWith("callout-") && i.severity === "error",
    ),
  ).toHaveLength(3);
});

test("project 14 and pack 3 migrate without losing geometry; older format numbers reject construction/development fields", async () => {
  const current = blankProject(),
    pack = templatePack("T-shirt"),
    old = {
      ...current,
      version: 14,
      fashion: { ...newFashion(), vectorPack: { ...pack, version: 3 } },
    };
  const next = await parseProject(JSON.stringify(old));
  expect(next.version).toBe(19);
  expect(next.fashion!.vectorPack).toEqual(pack);
  expect(parseVectorPack(JSON.stringify({ ...pack, version: 3 }))).toEqual(
    pack,
  );
  await expect(
    parseProject(
      JSON.stringify({
        ...old,
        fashion: {
          ...old.fashion,
          seamPlan: starterSeams(draftFashion(newFashion()), "teagan"),
        },
      }),
    ),
  ).rejects.toThrow("version 14");
  expect(() =>
    parseVectorPack(
      JSON.stringify({ ...pack, version: 3, development: emptyDevelopment() }),
    ),
  ).toThrow();
  const f = {
    ...newFashion(),
    seamPlan: starterSeams(draftFashion(newFashion()), "teagan"),
    vectorPack: pack,
  };
  expect(ProjectSchema.safeParse({ ...current, fashion: f }).success).toBe(
    true,
  );
  const r = await captureRevision(pack, "Snapshot", "");
  const h = await drawingHash(pack);
  expect(r.drawingHash).toBe(h);
});

test("drawing-only edits are detected and revision identifiers cannot silently be reused", async () => {
  const p = templatePack("T-shirt");
  const record = await captureRevision(p, "Proto", "");
  p.development = { ...emptyDevelopment(), revisions: [record] };
  expect(vectorPreflight(p).some((i) => i.code === "revision-changed")).toBe(
    false,
  );
  p.layers[0].nodes[0].x += 3;
  expect(revisionChanges(p, record)).toContain(
    "Technical flat geometry, appearance or grouping changed",
  );
  expect(vectorPreflight(p).some((i) => i.code === "revision-changed")).toBe(
    true,
  );
  await expect(captureRevision(p, "Reused A", "")).rejects.toThrow(
    "already recorded",
  );
  p.revision = "B";
  p.development.revisions.push(
    await captureRevision(p, "Revised", "Changed shoulder"),
  );
  expect(VectorPackSchema.safeParse(p).success).toBe(true);
  const invalid = structuredClone(p);
  invalid.development!.revisions[1].spec.revision = "A";
  expect(VectorPackSchema.safeParse(invalid).success).toBe(false);
  const sample = createSample(record, "M", "Sample");
  sample.measurements.pop();
  expect(
    VectorPackSchema.safeParse({
      ...p,
      development: { ...p.development, samples: [sample] },
    }).success,
  ).toBe(false);
});
