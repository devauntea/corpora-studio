import { z } from "zod";
import { strToU8, zipSync } from "fflate";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Project } from "./domain";

export const REVIEW_LIMITS = {
  revisions: 8,
  views: 8,
  notes: 100,
  imageBytes: 2_000_000,
  captureBytes: 12_000_000,
  encodedImages: 12_000_000,
  feedbackBytes: 300_000,
  edge: 2048,
} as const;
const id = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().datetime();
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),
      "Remove control characters.",
    );

const pngCrcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function pngCrc(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = pngCrcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngBytes(data: string, maxBytes: number): Uint8Array {
  if (
    data.length > Math.ceil(maxBytes / 3) * 4 + 22 ||
    !/^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      data,
    )
  )
    throw new Error(
      `Use a rendered PNG no larger than ${maxBytes / 1_000_000} MB.`,
    );
  const raw = atob(data.slice(22));
  if (raw.length > maxBytes)
    throw new Error(
      `Use a rendered PNG no larger than ${maxBytes / 1_000_000} MB.`,
    );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function cleanBoundedPng(data: string, maxBytes: number): Uint8Array {
  const bytes = pngBytes(data, maxBytes),
    signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 57 || signature.some((b, i) => bytes[i] !== b))
    throw new Error("The preview is not a PNG.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8,
    header = false,
    image = false,
    end = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)),
      next = offset + length + 12;
    if (next > bytes.length || end) throw new Error("Damaged PNG preview.");
    if (
      pngCrc(bytes.subarray(offset + 4, offset + 8 + length)) !==
      view.getUint32(offset + 8 + length)
    )
      throw new Error("PNG preview checksum failed.");
    if (
      !/^[A-Za-z]{4}$/.test(type) ||
      (type[0] === type[0].toUpperCase() &&
        !["IHDR", "PLTE", "IDAT", "IEND"].includes(type))
    )
      throw new Error("Unsupported PNG chunk.");
    if (!header) {
      if (type !== "IHDR" || length !== 13)
        throw new Error("Missing PNG dimensions.");
      const width = view.getUint32(offset + 8),
        height = view.getUint32(offset + 12);
      if (
        !width ||
        !height ||
        width > REVIEW_LIMITS.edge ||
        height > REVIEW_LIMITS.edge
      )
        throw new Error(
          "Review previews must be at most 2048 pixels per side.",
        );
      header = true;
    } else if (type === "IHDR") throw new Error("Duplicate PNG header.");
    if (type === "IDAT") image = true;
    if (type === "IEND") {
      if (length || !image || next !== bytes.length)
        throw new Error("Damaged PNG ending.");
      end = true;
    }
    if (["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(type))
      chunks.push(bytes.slice(offset, next));
    offset = next;
  }
  if (!end || offset !== bytes.length)
    throw new Error("Incomplete PNG preview.");
  const output = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return output;
}
/** Validates persisted PNG framing and removes all ancillary metadata on export. */
export function cleanReviewPng(data: string): Uint8Array {
  return cleanBoundedPng(data, REVIEW_LIMITS.imageBytes);
}
function pngValid(value: string) {
  try {
    cleanReviewPng(value);
    return true;
  } catch {
    return false;
  }
}
const viewSchema = z
  .object({
    id,
    name: text(100),
    objectName: text(100),
    studio: z.enum(["tattoo", "fashion"]),
    capturedAt: date,
    png: z
      .string()
      .max(2_666_700)
      .refine(pngValid, "Invalid or oversized rendered PNG"),
  })
  .strict();
const noteSchema = z
  .object({
    id,
    viewId: id.optional(),
    objectName: text(100),
    text: text(2000),
    author: text(100),
    createdAt: date,
    status: z.enum(["open", "resolved"]),
    resolvedAt: date.optional(),
    origin: z.enum(["local", "feedback"]),
  })
  .strict();
const acknowledgementSchema = z
  .object({
    id,
    name: text(100),
    text: text(500),
    at: date,
    viewIds: z
      .array(id)
      .min(1)
      .max(REVIEW_LIMITS.views)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate acknowledgement view",
      ),
  })
  .strict();
const dimensionSchema = z
  .object({
    label: text(100),
    valueMm: z.number().finite().min(0).max(100_000),
    source: z.enum(["entered", "estimated"]),
  })
  .strict();
const revisionSchema = z
  .object({
    id,
    hash,
    label: text(120),
    projectId: id,
    projectName: text(100),
    projectRevision: z.string().max(100),
    frozenAt: date,
    studio: z.enum(["tattoo", "fashion"]),
    dimensions: z.array(dimensionSchema).max(24),
    views: z.array(viewSchema).max(REVIEW_LIMITS.views),
    notes: z.array(noteSchema).max(REVIEW_LIMITS.notes),
    acknowledgements: z.array(acknowledgementSchema).max(20),
  })
  .strict();
export const reviewSchema = z
  .object({
    version: z.literal(1),
    revisions: z.array(revisionSchema).max(REVIEW_LIMITS.revisions),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (
      new Set(value.revisions.map((r) => r.hash)).size !==
      value.revisions.length
    )
      issue("Duplicate revision fingerprint.");
    const ids = value.revisions.flatMap((r) => [
      r.id,
      ...r.views.map((v) => v.id),
      ...r.notes.map((n) => n.id),
      ...r.acknowledgements.map((a) => a.id),
    ]);
    if (new Set(ids).size !== ids.length) issue("Duplicate review ID.");
    if (
      value.revisions.reduce(
        (n, r) => n + r.views.reduce((t, v) => t + v.png.length, 0),
        0,
      ) > REVIEW_LIMITS.encodedImages
    )
      issue("Review previews exceed the 12 MB local budget.");
    for (const r of value.revisions) {
      if (
        r.acknowledgements.some((a) =>
          a.viewIds.some((id) => !r.views.some((v) => v.id === id)),
        )
      )
        issue("Acknowledgement points to an unknown view.");
      if (
        r.notes.some((n) => n.viewId && !r.views.some((v) => v.id === n.viewId))
      )
        issue("Note points to an unknown view.");
      if (
        r.notes.some(
          (n) =>
            (n.status === "open" && n.resolvedAt) ||
            (n.status === "resolved" && !n.resolvedAt),
        )
      )
        issue("Note resolution record does not match its status.");
    }
  });
export type ReviewData = z.infer<typeof reviewSchema>;
export type ReviewRevision = z.infer<typeof revisionSchema>;
export type ReviewView = z.infer<typeof viewSchema>;
export type ReviewNote = z.infer<typeof noteSchema>;
export const defaultReview = (): ReviewData => ({ version: 1, revisions: [] });

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((v) => canonical(v === undefined ? null : v)).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
export async function reviewProjectHash(project: Project): Promise<string> {
  const content = Object.fromEntries(
    Object.entries(project).filter(([key]) => key !== "review"),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(content)),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function freezeReviewRevision(
  project: Project,
  data: ReviewData,
  label: string,
  studio: "tattoo" | "fashion",
): Promise<ReviewData> {
  const current = reviewSchema.parse(data),
    fingerprint = await reviewProjectHash(project);
  if (current.revisions.some((r) => r.projectId !== project.id))
    throw new Error("Review revisions belong to another project.");
  if (current.revisions.some((r) => r.hash === fingerprint)) return current;
  if (current.revisions.length >= REVIEW_LIMITS.revisions)
    throw new Error(
      "Keep up to 8 review revisions. Remove an older revision first.",
    );
  const dimensions: ReviewRevision["dimensions"] =
    studio === "tattoo"
      ? [
          {
            label: "Model section length",
            valueMm: project.body.length,
            source: "estimated",
          },
        ]
      : project.fashion
        ? [
            {
              label: "Draft seam allowance",
              valueMm: project.fashion.seamAllowance,
              source: "entered",
            },
          ]
        : [];
  return reviewSchema.parse({
    version: 1,
    revisions: [
      ...current.revisions,
      {
        id: crypto.randomUUID(),
        hash: fingerprint,
        label:
          label.trim() ||
          project.revision ||
          `Revision ${current.revisions.length + 1}`,
        projectId: project.id,
        projectName: project.name,
        projectRevision: project.revision,
        frozenAt: new Date().toISOString(),
        studio,
        dimensions,
        views: [],
        notes: [],
        acknowledgements: [],
      },
    ],
  });
}
export async function prepareReviewCapture(data: string): Promise<string> {
  // Only a local rendered PNG is accepted; images are decoded and re-encoded to
  // strip file metadata. A remote URL or raw SVG cannot enter the review bundle.
  // Rendered captures can exceed the persisted-view budget. Bound their bytes
  // and declared dimensions before decoding, then shrink to the stricter limit.
  cleanBoundedPng(data, REVIEW_LIMITS.captureBytes);
  const image = new Image();
  image.src = data;
  await image.decode();
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth > REVIEW_LIMITS.edge ||
    image.naturalHeight > REVIEW_LIMITS.edge
  )
    throw new Error("Review previews must be at most 2048 pixels per side.");
  let size = Math.min(
    1,
    1600 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * size));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * size));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Preview canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    const encoded = png.slice(22),
      byteLength =
        (encoded.length / 4) * 3 -
        (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
    if (byteLength <= REVIEW_LIMITS.imageBytes) {
      cleanReviewPng(png);
      return png;
    }
    size *= 0.75;
  }
  throw new Error(
    "This preview is too large for a review. Use a smaller rendered view.",
  );
}
export function addReviewView(
  data: ReviewData,
  revisionHash: string,
  view: Omit<ReviewView, "id" | "capturedAt">,
): ReviewData {
  const next = reviewSchema.parse(data),
    revision = next.revisions.find((r) => r.hash === revisionHash);
  if (!revision) throw new Error("Unknown review revision.");
  revision.views.push({
    ...view,
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
  });
  return reviewSchema.parse(next);
}
export function addReviewNote(
  data: ReviewData,
  revisionHash: string,
  input: Pick<ReviewNote, "objectName" | "text" | "author" | "viewId">,
): ReviewData {
  const next = reviewSchema.parse(data),
    revision = next.revisions.find((r) => r.hash === revisionHash);
  if (!revision) throw new Error("Unknown review revision.");
  revision.notes.push({
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "open",
    origin: "local",
  });
  return reviewSchema.parse(next);
}
export function setReviewNoteStatus(
  data: ReviewData,
  revisionHash: string,
  noteId: string,
  status: "open" | "resolved",
): ReviewData {
  const next = reviewSchema.parse(data),
    note = next.revisions
      .find((r) => r.hash === revisionHash)
      ?.notes.find((n) => n.id === noteId);
  if (!note) throw new Error("Unknown review note.");
  note.status = status;
  if (status === "resolved") note.resolvedAt = new Date().toISOString();
  else delete note.resolvedAt;
  return reviewSchema.parse(next);
}
export const REVIEW_ACKNOWLEDGEMENT =
  "I reviewed the selected views of this revision.";
export function acknowledgeReview(
  data: ReviewData,
  revisionHash: string,
  name: string,
): ReviewData {
  const next = reviewSchema.parse(data),
    revision = next.revisions.find((r) => r.hash === revisionHash);
  if (!revision) throw new Error("Unknown review revision.");
  if (!revision.views.length)
    throw new Error("Capture a view before recording an acknowledgement.");
  revision.acknowledgements.push({
    viewIds: revision.views.map((v) => v.id),
    id: crypto.randomUUID(),
    name,
    text: REVIEW_ACKNOWLEDGEMENT,
    at: new Date().toISOString(),
  });
  return reviewSchema.parse(next);
}
const feedbackNoteSchema = z
  .object({
    id,
    viewId: id.optional(),
    objectName: text(100),
    text: text(2000),
    createdAt: date,
  })
  .strict();
export const reviewFeedbackSchema = z
  .object({
    format: z.literal("form-studio-review-feedback"),
    version: z.literal(1),
    revisionHash: hash,
    reviewer: text(100),
    notes: z.array(feedbackNoteSchema).max(100),
    acknowledgement: acknowledgementSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.notes.map((n) => n.id)).size !== value.notes.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate feedback note ID.",
      });
    if (value.acknowledgement && value.acknowledgement.name !== value.reviewer)
      context.addIssue({
        code: "custom",
        message: "Acknowledgement name must match the reviewer.",
      });
  });
export function importReviewFeedback(
  data: ReviewData,
  content: string,
): { review: ReviewData; added: number; revisionHash: string } {
  if (new TextEncoder().encode(content).length > REVIEW_LIMITS.feedbackBytes)
    throw new Error("Feedback exceeds 300 KB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Choose a valid review feedback JSON file.");
  }
  const result = reviewFeedbackSchema.safeParse(parsed);
  if (!result.success)
    throw new Error("Feedback has invalid fields, notes or revision details.");
  const feedback = result.data,
    next = reviewSchema.parse(data),
    revision = next.revisions.find((r) => r.hash === feedback.revisionHash);
  if (!revision)
    throw new Error(
      "This feedback belongs to an unknown revision. Open the project that created its review bundle.",
    );
  let added = 0;
  for (const note of feedback.notes) {
    if (note.viewId && !revision.views.some((v) => v.id === note.viewId))
      throw new Error("Feedback references a view outside this revision.");
    const candidate: ReviewNote = {
        ...note,
        author: feedback.reviewer,
        status: "open",
        origin: "feedback",
      },
      existing = revision.notes.find((n) => n.id === note.id);
    if (existing) {
      if (
        existing.text !== candidate.text ||
        existing.author !== candidate.author ||
        existing.viewId !== candidate.viewId ||
        existing.objectName !== candidate.objectName ||
        existing.createdAt !== candidate.createdAt ||
        existing.origin !== "feedback"
      )
        throw new Error("A feedback note ID conflicts with an existing note.");
    } else {
      revision.notes.push(candidate);
      added++;
    }
  }
  if (feedback.acknowledgement) {
    if (
      feedback.acknowledgement.viewIds.some(
        (id) => !revision.views.some((v) => v.id === id),
      )
    )
      throw new Error(
        "Acknowledgement references a view outside this revision.",
      );
    const existing = revision.acknowledgements.find(
      (a) => a.id === feedback.acknowledgement!.id,
    );
    if (existing && canonical(existing) !== canonical(feedback.acknowledgement))
      throw new Error(
        "An acknowledgement ID conflicts with an existing record.",
      );
    if (!existing) {
      revision.acknowledgements.push(feedback.acknowledgement);
      added++;
    }
  }
  return {
    review: reviewSchema.parse(next),
    added,
    revisionHash: revision.hash,
  };
}
export const escapeReviewHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const safeFileName = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9 _-]/g, "-")
    .slice(0, 70)
    .trim() || "study";

export function reviewBundleFiles(
  data: ReviewData,
  revisionHash: string,
  selectedViewIds: string[],
): Record<string, Uint8Array> {
  const checked = reviewSchema.parse(data),
    revision = checked.revisions.find((r) => r.hash === revisionHash);
  if (!revision) throw new Error("Choose a known revision.");
  if (
    !selectedViewIds.length ||
    new Set(selectedViewIds).size !== selectedViewIds.length
  )
    throw new Error("Explicitly select at least one unique view to share.");
  if (selectedViewIds.some((id) => !revision.views.some((v) => v.id === id)))
    throw new Error("A selected view does not belong to this revision.");
  const views = revision.views.filter((v) => selectedViewIds.includes(v.id));
  const notes = revision.notes.filter(
    (n) => !n.viewId || selectedViewIds.includes(n.viewId),
  );
  const metadata = {
    format: "form-studio-review",
    version: 1,
    revision: {
      id: revision.id,
      hash: revision.hash,
      label: revision.label,
      projectId: revision.projectId,
      projectName: revision.projectName,
      projectRevision: revision.projectRevision,
      frozenAt: revision.frozenAt,
      studio: revision.studio,
      dimensions: revision.dimensions,
    },
    views: views.map((v, index) => ({
      id: v.id,
      name: v.name,
      objectName: v.objectName,
      studio: v.studio,
      capturedAt: v.capturedAt,
      file: `views/view-${index + 1}.png`,
    })),
    notes,
    acknowledgements: revision.acknowledgements.filter((a) =>
      a.viewIds.every((id) => selectedViewIds.includes(id)),
    ),
  };
  const files: Record<string, Uint8Array> = {};
  views.forEach((v, i) => {
    files[`views/view-${i + 1}.png`] = cleanReviewPng(v.png);
  });
  files["review.json"] = strToU8(JSON.stringify(metadata, null, 2));
  files["index.html"] = strToU8(reviewHtml(metadata));
  files["README.txt"] = strToU8(
    `CORPORA STUDIO — LOCAL REVIEW\n\nOpen index.html in a browser. Add notes and download feedback JSON, then return that file to the project owner.\n\nRevision: ${revision.label}\nFingerprint: ${revision.hash}\nViews shared: ${views.length}\n\nThis package contains only the explicitly selected rendered views and their review metadata, including notes attached to the entire revision. Acknowledgements are included only when every view in their recorded scope is selected. It contains no original source photographs, editable assets, raw project or geometry. Dimensions are in millimetres and carry an entered/estimated source label. An acknowledgement records review only; it is not a legal signature, fit approval or manufacturing certification.\n`,
  );
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        format: "form-studio-review-manifest",
        version: 1,
        revisionHash: revision.hash,
        selectedViewIds: views.map((v) => v.id),
        files: [...Object.keys(files), "manifest.json"],
        privacy:
          "Selected rendered PNG views and review metadata only; no raw project or original images.",
      },
      null,
      2,
    ),
  );
  return files;
}
type BundleMetadata = {
  revision: Pick<
    ReviewRevision,
    "hash" | "label" | "projectName" | "dimensions"
  >;
  views: { id: string; name: string; objectName: string; file: string }[];
  notes: ReviewNote[];
  acknowledgements: ReviewRevision["acknowledgements"];
};
function reviewHtml(meta: BundleMetadata): string {
  const esc = escapeReviewHtml;
  // User content appears as escaped text/attributes, never executable source.
  const safeJson = JSON.stringify({
    hash: meta.revision.hash,
    views: meta.views.map((v) => ({
      id: v.id,
      name: v.name,
      objectName: v.objectName,
    })),
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const feedbackScript = `(() => {
    "use strict";
    const ctx = JSON.parse(document.getElementById("context").textContent),
      notes = [], get = id => document.getElementById(id),
      status = text => get("status").textContent = text,
      uid = () => crypto.randomUUID ? crypto.randomUUID() :
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === "x" ? r : (r & 3 | 8)).toString(16);
        });
    let editingId = null;
    const resetEditor = () => {
      editingId = null;
      get("note").value = "";
      get("add").textContent = "Add note";
      get("cancel").hidden = true;
    };
    const renderNotes = () => {
      get("notes").replaceChildren();
      for (const note of notes) {
        const li = document.createElement("li"), label = document.createElement("span"),
          edit = document.createElement("button"), remove = document.createElement("button");
        label.textContent = note.objectName + ": " + note.text;
        edit.type = remove.type = "button";
        edit.textContent = "Edit note";
        remove.textContent = "Remove note";
        edit.onclick = () => {
          if (editingId || get("note").value.trim())
            return status("Save or cancel your unfinished note before editing another.");
          editingId = note.id;
          get("object").value = note.objectName;
          get("note").value = note.text;
          get("view").value = note.viewId || "";
          get("add").textContent = "Save note";
          get("cancel").hidden = false;
          get("note").focus();
          status("Editing note. Save your changes before downloading.");
        };
        remove.onclick = () => {
          notes.splice(notes.findIndex(item => item.id === note.id), 1);
          if (editingId === note.id) resetEditor();
          renderNotes();
          status("Note removed. Download feedback to save this change.");
        };
        li.append(label, edit, remove);
        get("notes").append(li);
      }
    };
    get("cancel").onclick = () => {
      resetEditor();
      status("Note edit cancelled. The saved note is unchanged.");
    };
    get("view").onchange = () => {
      const view = ctx.views.find(v => v.id === get("view").value);
      if (view) get("object").value = view.objectName;
    };
    get("add").onclick = () => {
      const text = get("note").value.trim(), objectName = get("object").value.trim();
      if (!text || !objectName) return status("Enter an object or area and a note.");
      if (!editingId && notes.length >= ${REVIEW_LIMITS.notes})
        return status("This feedback file can hold ${REVIEW_LIMITS.notes} notes.");
      const edited = editingId !== null,
        note = edited ? notes.find(item => item.id === editingId) :
          { id: uid(), createdAt: new Date().toISOString() };
      note.objectName = objectName;
      note.text = text;
      if (get("view").value) note.viewId = get("view").value;
      else delete note.viewId;
      if (!edited) notes.push(note);
      resetEditor();
      renderNotes();
      status(edited ? "Note updated. Download feedback before closing." :
        "Note added. Download feedback before closing.");
    };
    get("download").onclick = () => {
      const reviewer = get("reviewer").value.trim();
      if (!reviewer) return status("Enter your name first.");
      if (editingId || get("note").value.trim())
        return status("Save or cancel your unfinished note before downloading.");
      if (!notes.length && !get("ack").checked)
        return status("Add a note or acknowledge the review first.");
      const payload = { format: "form-studio-review-feedback", version: 1,
        revisionHash: ctx.hash, reviewer, notes };
      if (get("ack").checked) payload.acknowledgement = {
        id: uid(), name: reviewer, text: "${REVIEW_ACKNOWLEDGEMENT}", at: new Date().toISOString(), viewIds: ctx.views.map(view => view.id)
      };
      const content = JSON.stringify(payload, null, 2),
        bytes = new TextEncoder().encode(content).length;
      if (bytes > ${REVIEW_LIMITS.feedbackBytes})
        return status("Feedback is too long (" + Math.ceil(bytes / 1000) +
          " KB; maximum ${REVIEW_LIMITS.feedbackBytes / 1000} KB). Edit or remove notes, then download again.");
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" })),
        link = document.createElement("a");
      link.href = url;
      link.download = "form-review-feedback-" + ctx.hash.slice(0, 12) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status("Feedback downloaded. Return that JSON file to the project owner.");
    };
  })();`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>${esc(meta.revision.projectName)} · review</title><style>body{margin:0;background:#101010;color:#eee;font:16px/1.5 system-ui}main{max-width:1000px;margin:auto;padding:36px 24px}h1{font-size:36px;letter-spacing:-.04em}h2{margin-top:40px}small,p{color:#bbb}code{overflow-wrap:anywhere}figure{margin:24px 0;border:1px solid #444;padding:16px}img{display:block;max-width:100%;max-height:700px;margin:auto}label{display:block;margin:16px 0}input,select,textarea,button{font:inherit;padding:10px;border:1px solid #666;border-radius:5px;background:#202020;color:#fff;box-sizing:border-box}input:not([type=checkbox]),select,textarea{display:block;width:100%;max-width:660px}button{cursor:pointer;margin:8px 12px 8px 0}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #fff}textarea{min-height:100px}li{margin:12px 0;white-space:pre-wrap}#status{min-height:24px;color:#fff}.muted{font-size:14px}fieldset{border:1px solid #555;padding:20px}</style></head><body><main><p>CORPORA STUDIO / LOCAL REVIEW</p><h1>${esc(meta.revision.projectName)}</h1><h2>${esc(meta.revision.label)}</h2><p class="muted">Exact revision fingerprint<br><code>${meta.revision.hash}</code></p>${meta.revision.dimensions.length ? `<ul>${meta.revision.dimensions.map((d) => `<li>${esc(d.label)}: ${d.valueMm} mm (${d.source})</li>`).join("")}</ul>` : ""}${meta.views.map((v) => `<figure><img src="${v.file}" alt="${esc(v.name)}"><figcaption><strong>${esc(v.name)}</strong> · ${esc(v.objectName)}</figcaption></figure>`).join("")}<h2>Existing notes</h2><ul>${meta.notes.map((n) => `<li><strong>${esc(n.objectName)}</strong> · ${esc(n.author)} · ${n.status}<br>${esc(n.text)}</li>`).join("") || "<li>No notes yet.</li>"}</ul><h2>Recorded acknowledgements</h2><ul>${meta.acknowledgements.map((a) => `<li>${esc(a.name)} · ${esc(a.text)} · ${esc(a.at)}<br>Views: ${a.viewIds.map((id) => esc(meta.views.find((v) => v.id === id)?.name ?? "Unknown view")).join(", ")}</li>`).join("") || "<li>None recorded.</li>"}</ul><h2>Your feedback</h2><p>Feedback is tied to this revision. Download the JSON and return it to the project owner. Your notes stay on this page until you close it; download before leaving.</p><fieldset><legend>Reviewer</legend><label>Your name<input id="reviewer" maxlength="100" required></label><label>View<select id="view" aria-label="View"><option value="">Entire revision</option>${meta.views.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join("")}</select></label><label>Object or area<input id="object" maxlength="100" placeholder="e.g. left sleeve / neckline"></label><label>Note<textarea id="note" maxlength="2000"></textarea></label><button id="add" type="button">Add note</button><button id="cancel" type="button" hidden>Cancel edit</button><ol id="notes"></ol><label><input id="ack" type="checkbox"> ${REVIEW_ACKNOWLEDGEMENT}</label><p class="muted">This acknowledgement is a review record, not a signature or manufacturing certification.</p><button id="download" type="button">Download feedback JSON</button><p id="status" role="status"></p></fieldset></main><script type="application/json" id="context">${safeJson}</script><script>${feedbackScript}</script></body></html>`;
}
export function exportReviewBundle(
  data: ReviewData,
  revisionHash: string,
  selectedViewIds: string[],
): Uint8Array {
  return zipSync(reviewBundleFiles(data, revisionHash, selectedViewIds), {
    level: 6,
  });
}
export async function saveReviewBundle(
  bytes: Uint8Array,
  name: string,
): Promise<string | null> {
  if (bytes.length > 16_000_000)
    throw new Error("Review bundle exceeds 16 MB.");
  const safe = safeFileName(name);
  if (isTauri()) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return invoke("save_review_bundle", { data: btoa(binary), name: safe });
  }
  const url = URL.createObjectURL(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = `${safe}-review.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "Downloaded review bundle";
}
