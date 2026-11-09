import { describe, expect, test, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { strFromU8, unzipSync, zlibSync } from "fflate";
import { blankProject, parseProject } from "../src/domain";
import { newFashion } from "../src/fashion-model";
import {
  REVIEW_ACKNOWLEDGEMENT,
  REVIEW_LIMITS,
  addReviewNote,
  addReviewView,
  acknowledgeReview,
  cleanReviewPng,
  defaultReview,
  escapeReviewHtml,
  exportReviewBundle,
  freezeReviewRevision,
  importReviewFeedback,
  prepareReviewCapture,
  reviewBundleFiles,
  reviewProjectHash,
  reviewSchema,
  setReviewNoteStatus,
} from "../src/review-room";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
function crc(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const b of bytes) {
    value ^= b;
    for (let i = 0; i < 8; i++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, payload: Uint8Array) {
  const chunk = new Uint8Array(payload.length + 12),
    view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(payload, 8);
  view.setUint32(chunk.length - 4, crc(chunk.subarray(4, chunk.length - 4)));
  return chunk;
}
function largeRenderedPng() {
  const width = 1024,
    height = 768,
    header = new Uint8Array(13),
    headerView = new DataView(header.buffer),
    pixels = new Uint8Array((width * 4 + 1) * height);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  // A valid RGBA capture with uncompressed IDAT exceeds the persisted 2 MB cap.
  // Zero filter bytes begin each scanline; all other pixels are opaque white.
  pixels.fill(255);
  for (let row = 0; row < height; row++) pixels[row * (width * 4 + 1)] = 0;
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlibSync(pixels, { level: 0 })),
    pngChunk("IEND", new Uint8Array()),
  ]).toString("base64")}`;
}
class FeedbackElement {
  value = "";
  textContent = "";
  hidden = false;
  checked = false;
  type = "";
  href = "";
  download = "";
  children: FeedbackElement[] = [];
  onclick: (() => void) | null = null;
  onchange: (() => void) | null = null;
  append(...elements: FeedbackElement[]) {
    this.children.push(...elements);
  }
  replaceChildren() {
    this.children = [];
  }
  focus() {}
  click() {
    this.onclick?.();
  }
}
function runFeedbackPage(html: string) {
  const elements = new Map<string, FeedbackElement>(),
    downloads: Blob[] = [],
    generatedIds: string[] = [],
    get = (id: string) => {
      if (!elements.has(id)) elements.set(id, new FeedbackElement());
      return elements.get(id)!;
    };
  get("context").textContent = html.match(
    /<script type="application\/json" id="context">([\s\S]*?)<\/script>/,
  )![1];
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1], {
    document: {
      getElementById: get,
      createElement: () => new FeedbackElement(),
    },
    crypto: {
      randomUUID: () => {
        const id = crypto.randomUUID();
        generatedIds.push(id);
        return id;
      },
    },
    Blob,
    TextEncoder,
    URL: {
      createObjectURL: (blob: Blob) => {
        downloads.push(blob);
        return "blob:feedback";
      },
      revokeObjectURL: () => {},
    },
    setTimeout: (callback: () => void) => callback(),
  });
  return { get, downloads, generatedIds };
}
async function fixture() {
  const project = blankProject();
  project.name = 'Review </script><img src="https://example.invalid/private">';
  let review = await freezeReviewRevision(
    project,
    defaultReview(),
    "Toile A",
    "tattoo",
  );
  const hash = review.revisions[0].hash;
  review = addReviewView(review, hash, {
    name: "Front",
    objectName: "Chest",
    studio: "tattoo",
    png: PNG,
  });
  review = addReviewView(review, hash, {
    name: "Private back",
    objectName: "Back",
    studio: "tattoo",
    png: PNG,
  });
  return {
    project,
    review,
    hash,
    first: review.revisions[0].views[0].id,
    second: review.revisions[0].views[1].id,
  };
}
function feedback(hash: string, viewId?: string) {
  return {
    format: "form-studio-review-feedback",
    version: 1,
    revisionHash: hash,
    reviewer: "Sample maker",
    notes: [
      {
        id: crypto.randomUUID(),
        ...(viewId ? { viewId } : {}),
        objectName: "Chest placement",
        text: "Shift 5 mm toward the shoulder.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
describe("review revision identity", () => {
  test("hash ignores review records and object-key ordering, but catches geometry and original image changes", async () => {
    const { project, review, hash } = await fixture();
    expect(await reviewProjectHash({ ...project, review })).toBe(hash);
    expect(
      await reviewProjectHash(
        Object.fromEntries(Object.entries(project).reverse()) as typeof project,
      ),
    ).toBe(hash);
    expect(
      await reviewProjectHash({
        ...project,
        body: { ...project.body, length: project.body.length + 1 },
      }),
    ).not.toBe(hash);
    expect(
      await reviewProjectHash({
        ...project,
        assets: [
          {
            id: crypto.randomUUID(),
            name: "Private photograph",
            mime: "image/png",
            data: PNG,
            sha256: "a".repeat(64),
            width: 1,
            height: 1,
          },
        ],
      }),
    ).not.toBe(hash);
  });
  test("fashion reviews disclose the entered draft allowance without exporting a body-measurement table", async () => {
    const project = { ...blankProject(), fashion: newFashion() };
    const review = await freezeReviewRevision(
      project,
      defaultReview(),
      "Garment",
      "fashion",
    );
    expect(review.revisions[0].dimensions).toEqual([
      {
        label: "Draft seam allowance",
        valueMm: project.fashion.seamAllowance,
        source: "entered",
      },
    ]);
    expect(JSON.stringify(review)).not.toContain('"measurements"');
  });
  test("v17 migrates without review data and rejects injected future review fields", async () => {
    const project = blankProject();
    const legacy = { ...project, version: 17 };
    const migrated = await parseProject(JSON.stringify(legacy));
    expect(migrated.version).toBe(19);
    expect(migrated.review).toBeUndefined();
    await expect(
      parseProject(JSON.stringify({ ...legacy, review: defaultReview() })),
    ).rejects.toThrow();
  });
  test("freezing the same revision reuses its identity and saves review round trips", async () => {
    const { project, review, hash } = await fixture();
    const again = await freezeReviewRevision(
      { ...project, review },
      review,
      "Different label",
      "fashion",
    );
    expect(again.revisions).toHaveLength(1);
    expect(again.revisions[0].hash).toBe(hash);
    expect(again.revisions[0].projectId).toBe(project.id);
    const reopened = await parseProject(JSON.stringify({ ...project, review }));
    expect(reopened.review).toEqual(review);
  });
  test("revision count is bounded and cross-project review records fail project validation", async () => {
    const project = blankProject();
    let review = defaultReview();
    for (let i = 0; i < 8; i++)
      review = await freezeReviewRevision(
        { ...project, revision: String(i) },
        review,
        `R${i}`,
        "tattoo",
      );
    await expect(
      freezeReviewRevision(
        { ...project, revision: "ninth" },
        review,
        "R9",
        "tattoo",
      ),
    ).rejects.toThrow("8 review revisions");
    await expect(
      parseProject(JSON.stringify({ ...blankProject(), review })),
    ).rejects.toThrow();
  });
});
describe("local review validation and feedback", () => {
  test("notes resolve/reopen, and acknowledgements remain ordinary review records", async () => {
    const { review, hash, first } = await fixture();
    const added = addReviewNote(review, hash, {
      objectName: "Chest",
      text: "Check alignment",
      author: "Artist",
      viewId: first,
    });
    const noteId = added.revisions[0].notes[0].id;
    const resolved = setReviewNoteStatus(added, hash, noteId, "resolved");
    expect(resolved.revisions[0].notes[0].resolvedAt).toBeTruthy();
    const reopened = setReviewNoteStatus(resolved, hash, noteId, "open");
    expect(reopened.revisions[0].notes[0].resolvedAt).toBeUndefined();
    const ack = acknowledgeReview(reopened, hash, "Artist").revisions[0]
      .acknowledgements[0];
    expect(ack.text).toBe(REVIEW_ACKNOWLEDGEMENT);
    expect(review.revisions[0].notes).toEqual([]);
  });
  test("rejects unknown revision hashes and unknown view IDs atomically", async () => {
    const { review, hash } = await fixture(),
      before = JSON.stringify(review);
    expect(() =>
      importReviewFeedback(review, JSON.stringify(feedback("a".repeat(64)))),
    ).toThrow("unknown revision");
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify(feedback(hash, crypto.randomUUID())),
      ),
    ).toThrow("outside this revision");
    expect(JSON.stringify(review)).toBe(before);
  });
  test("imports notes idempotently, preserves local resolved status, and rejects ID collisions", async () => {
    const { review, hash, first } = await fixture(),
      payload = feedback(hash, first);
    const result = importReviewFeedback(review, JSON.stringify(payload));
    expect(result.added).toBe(1);
    expect(result.review.revisions[0].notes[0]).toMatchObject({
      origin: "feedback",
      author: "Sample maker",
      status: "open",
    });
    const resolved = setReviewNoteStatus(
      result.review,
      hash,
      payload.notes[0].id,
      "resolved",
    );
    const replay = importReviewFeedback(resolved, JSON.stringify(payload));
    expect(replay.added).toBe(0);
    expect(replay.review.revisions[0].notes[0].status).toBe("resolved");
    payload.notes[0].text = "Different content under the same ID";
    expect(() =>
      importReviewFeedback(replay.review, JSON.stringify(payload)),
    ).toThrow("conflicts");
  });
  test("strict schema rejects raw project/image fields, duplicate IDs and oversized inputs", async () => {
    const { review, hash, first } = await fixture(),
      payload = feedback(hash, first);
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify({ ...payload, project: blankProject() }),
      ),
    ).toThrow("invalid fields");
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify({
          ...payload,
          notes: [{ ...payload.notes[0], png: PNG }],
        }),
      ),
    ).toThrow("invalid fields");
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify({
          ...payload,
          notes: [payload.notes[0], payload.notes[0]],
        }),
      ),
    ).toThrow("invalid fields");
    expect(() => importReviewFeedback(review, " ".repeat(300_001))).toThrow(
      "300 KB",
    );
    expect(() =>
      addReviewNote(review, hash, {
        author: "A",
        objectName: "B",
        text: "x".repeat(2001),
      }),
    ).toThrow();
    const duplicate = structuredClone(review);
    duplicate.revisions[0].views[1].id = first;
    expect(reviewSchema.safeParse(duplicate).success).toBe(false);
  });
  test("view and aggregate image budgets reject overflow, remote resources and malformed PNGs", async () => {
    const { review, hash } = await fixture();
    for (const png of [
      "https://example.com/a.png",
      "data:image/svg+xml,<svg/>",
      "data:image/png;base64,aW1hZ2U=",
      `${PNG}trailing`,
    ]) {
      expect(() =>
        addReviewView(review, hash, {
          name: "Bad",
          objectName: "Bad",
          studio: "tattoo",
          png,
        }),
      ).toThrow();
    }
    let next = review;
    for (let i = 2; i < 8; i++)
      next = addReviewView(next, hash, {
        name: `${i}`,
        objectName: "Body",
        studio: "tattoo",
        png: PNG,
      });
    expect(() =>
      addReviewView(next, hash, {
        name: "9",
        objectName: "Body",
        studio: "tattoo",
        png: PNG,
      }),
    ).toThrow();
    const bytes = Uint8Array.from(atob(PNG.slice(22)), (c) => c.charCodeAt(0));
    new DataView(bytes.buffer).setUint32(16, 9999);
    new DataView(bytes.buffer).setUint32(29, crc(bytes.subarray(12, 29)));
    expect(() =>
      cleanReviewPng(
        `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`,
      ),
    ).toThrow("2048");
    expect(() =>
      cleanReviewPng(`data:image/png;base64,${"A".repeat(2_666_700)}`),
    ).toThrow();
  });
});
describe("acknowledgement scope", () => {
  test("records exact viewed IDs; later captures do not expand that scope and partial exports omit the record", async () => {
    const { review, hash, first, second } = await fixture();
    const acknowledged = acknowledgeReview(review, hash, "Artist");
    expect(acknowledged.revisions[0].acknowledgements[0].viewIds).toEqual([
      first,
      second,
    ]);
    const expanded = addReviewView(acknowledged, hash, {
      name: "Later view",
      objectName: "Arm",
      studio: "tattoo",
      png: PNG,
    });
    const third = expanded.revisions[0].views[2].id;
    expect(expanded.revisions[0].acknowledgements[0].viewIds).toEqual([
      first,
      second,
    ]);
    const partial = JSON.parse(
      strFromU8(reviewBundleFiles(expanded, hash, [first])["review.json"]),
    );
    expect(partial.acknowledgements).toEqual([]);
    const all = JSON.parse(
      strFromU8(
        reviewBundleFiles(expanded, hash, [first, second, third])[
          "review.json"
        ],
      ),
    );
    expect(all.acknowledgements[0].viewIds).toEqual([first, second]);
  });
  test("rejects missing, duplicate and unknown acknowledgement view scope in feedback", async () => {
    const { review, hash, first } = await fixture();
    const base = {
      ...feedback(hash, first),
      acknowledgement: {
        id: crypto.randomUUID(),
        name: "Sample maker",
        text: REVIEW_ACKNOWLEDGEMENT,
        at: new Date().toISOString(),
      },
    };
    expect(() => importReviewFeedback(review, JSON.stringify(base))).toThrow(
      "invalid fields",
    );
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify({
          ...base,
          acknowledgement: { ...base.acknowledgement, viewIds: [first, first] },
        }),
      ),
    ).toThrow("invalid fields");
    expect(() =>
      importReviewFeedback(
        review,
        JSON.stringify({
          ...base,
          acknowledgement: {
            ...base.acknowledgement,
            viewIds: [crypto.randomUUID()],
          },
        }),
      ),
    ).toThrow("outside this revision");
    expect(
      importReviewFeedback(
        review,
        JSON.stringify({
          ...base,
          acknowledgement: { ...base.acknowledgement, viewIds: [first] },
        }),
      ).review.revisions[0].acknowledgements[0].viewIds,
    ).toEqual([first]);
  });
});
describe("review bundle privacy and escaping", () => {
  test("only explicitly selected renders and matching notes are exported; no raw project is present", async () => {
    const { review, hash, first, second } = await fixture();
    const withNote = addReviewNote(
      addReviewNote(review, hash, {
        author: "A",
        objectName: "Chest",
        text: "Shared front note",
        viewId: first,
      }),
      hash,
      {
        author: "B",
        objectName: "Private back",
        text: "PRIVATE_BACK_NOTE",
        viewId: second,
      },
    );
    const files = reviewBundleFiles(withNote, hash, [first]);
    expect(Object.keys(files).sort()).toEqual([
      "README.txt",
      "index.html",
      "manifest.json",
      "review.json",
      "views/view-1.png",
    ]);
    const metadata = JSON.parse(strFromU8(files["review.json"]));
    expect(metadata.views).toHaveLength(1);
    expect(metadata.views[0].id).toBe(first);
    expect(metadata.notes).toHaveLength(1);
    const content = Object.entries(files)
      .filter(([name]) => !name.endsWith(".png"))
      .map(([, bytes]) => strFromU8(bytes))
      .join("\n");
    expect(content).not.toContain("PRIVATE_BACK_NOTE");
    expect(content).not.toContain("Private back");
    expect(content).not.toContain('"assets"');
    expect(content).not.toContain('"body"');
    expect(content).not.toContain('"png"');
    expect(
      Object.keys(unzipSync(exportReviewBundle(withNote, hash, [first]))),
    ).toEqual(Object.keys(files));
    expect(() => reviewBundleFiles(review, hash, [])).toThrow(
      "Explicitly select",
    );
    expect(() => reviewBundleFiles(review, hash, [first, first])).toThrow(
      "unique",
    );
    expect(() =>
      reviewBundleFiles(review, hash, [crypto.randomUUID()]),
    ).toThrow("does not belong");
  });
  test("untrusted labels and notes are escaped in HTML and cannot create external resources", async () => {
    const { review, hash, first } = await fixture();
    const malicious = addReviewNote(review, hash, {
      author: "<script>alert(1)</script>",
      objectName: '" onload="alert(1)',
      text: '<img src="https://bad.example/pixel">',
      viewId: first,
    });
    const html = strFromU8(
      reviewBundleFiles(malicious, hash, [first])["index.html"],
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('<img src="https://');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("connect-src 'none'");
    expect(escapeReviewHtml('<a x="1">&\'')).toBe(
      "&lt;a x=&quot;1&quot;&gt;&amp;&#39;",
    );
  });
  test("PNG export strips ancillary metadata and disallows appended payloads", () => {
    const bytes = Uint8Array.from(atob(PNG.slice(22)), (c) => c.charCodeAt(0));
    const payload = new TextEncoder().encode(
      "Author\0PRIVATE_ORIGINAL_PHOTO_METADATA",
    );
    const chunk = new Uint8Array(payload.length + 12);
    new DataView(chunk.buffer).setUint32(0, payload.length);
    chunk.set(new TextEncoder().encode("tEXt"), 4);
    chunk.set(payload, 8);
    new DataView(chunk.buffer).setUint32(
      chunk.length - 4,
      crc(chunk.subarray(4, chunk.length - 4)),
    );
    const decorated = new Uint8Array(bytes.length + chunk.length);
    decorated.set(bytes.subarray(0, 33));
    decorated.set(chunk, 33);
    decorated.set(bytes.subarray(33), 33 + chunk.length);
    const cleaned = cleanReviewPng(
      `data:image/png;base64,${btoa(String.fromCharCode(...decorated))}`,
    );
    expect(cleaned).toEqual(bytes);
    expect(() =>
      cleanReviewPng(
        `data:image/png;base64,${btoa(String.fromCharCode(...bytes, 0))}`,
      ),
    ).toThrow();
  });
  test("large bounded captures are re-encoded and resized before applying the persisted PNG limit", async () => {
    const input = largeRenderedPng(),
      sizes: [number, number][] = [],
      decode = vi.fn(async () => {}),
      canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => {
          sizes.push([canvas.width, canvas.height]);
          return sizes.length === 1 ? input : PNG;
        },
      };
    expect(() => cleanReviewPng(input)).toThrow("2 MB");
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 1024;
        naturalHeight = 768;
        decode = decode;
      },
    );
    vi.stubGlobal("document", { createElement: () => canvas });
    try {
      const output = await prepareReviewCapture(input);
      expect(output).toBe(PNG);
      expect(cleanReviewPng(output).byteLength).toBeLessThan(
        REVIEW_LIMITS.imageBytes,
      );
      expect(decode).toHaveBeenCalledOnce();
      expect(sizes).toEqual([
        [1024, 768],
        [768, 576],
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test("capture byte and dimension bounds still reject input before decoding", async () => {
    const decode = vi.fn(async () => {});
    vi.stubGlobal(
      "Image",
      class {
        decode = decode;
      },
    );
    try {
      await expect(
        prepareReviewCapture(
          "data:image/png;base64," +
            "A".repeat(Math.ceil(REVIEW_LIMITS.captureBytes / 3) * 4 + 4),
        ),
      ).rejects.toThrow("12 MB");
      const bytes = Buffer.from(PNG.slice(22), "base64"),
        header = bytes.slice(16, 29);
      header.writeUInt32BE(REVIEW_LIMITS.edge + 1, 0);
      const oversizedDimensions = Buffer.concat([
        bytes.subarray(0, 8),
        pngChunk("IHDR", header),
        bytes.subarray(33),
      ]);
      await expect(
        prepareReviewCapture(
          "data:image/png;base64," + oversizedDimensions.toString("base64"),
        ),
      ).rejects.toThrow("2048 pixels");
      expect(decode).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test("offline feedback enforces UTF-8 bytes and remains editable until it can be imported", async () => {
    const { review, hash, first } = await fixture(),
      page = runFeedbackPage(
        strFromU8(reviewBundleFiles(review, hash, [first])["index.html"]),
      );
    page.get("reviewer").value = "Sample maker";
    page.get("view").value = first;
    for (let i = 0; i < 100; i++) {
      page.get("object").value = `Chest ${i}`;
      page.get("note").value = "袖".repeat(2000);
      page.get("add").click();
    }
    page.get("download").click();
    expect(page.downloads).toHaveLength(0);
    expect(page.get("status").textContent).toMatch(
      /too long.*maximum 300 KB.*Edit or remove/,
    );
    // An edit preserves identity and view association, and cannot be downloaded unfinished.
    page.get("notes").children[0].children[1].click();
    page.get("note").value = "Move toward shoulder.";
    page.get("download").click();
    expect(page.downloads).toHaveLength(0);
    expect(page.get("status").textContent).toContain("unfinished note");
    page.get("add").click();
    expect(page.get("notes").children).toHaveLength(100);
    expect(page.get("cancel").hidden).toBe(true);
    for (let i = 0; i < 60; i++)
      page.get("notes").children[1].children[2].click();
    page.get("download").click();
    expect(page.downloads).toHaveLength(1);
    const content = await page.downloads[0].text(),
      payload = JSON.parse(content);
    expect(new TextEncoder().encode(content).length).toBeLessThanOrEqual(
      REVIEW_LIMITS.feedbackBytes,
    );
    expect(payload.notes).toHaveLength(40);
    expect(payload.notes[0]).toMatchObject({
      id: page.generatedIds[0],
      viewId: first,
      text: "Move toward shoulder.",
    });
    const imported = importReviewFeedback(review, content);
    expect(imported.added).toBe(40);
    expect(imported.revisionHash).toBe(hash);
  });
});
