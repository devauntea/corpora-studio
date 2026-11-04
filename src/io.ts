import { invoke, isTauri } from "@tauri-apps/api/core";
import { sha256, type Asset } from "./domain";

export const native = isTauri();
export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}
export async function assetFromFile(file: File): Promise<Asset> {
  const heic = /\.heic$/i.test(file.name) || file.type === "image/heic";
  if (!heic && !["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or HEIC image.");
  if (file.size > 15_000_000)
    throw new Error("Choose an image smaller than 15 MB.");
  let data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.readAsDataURL(file);
  });
  if (heic) data = `data:image/heic;base64,${data.split(",")[1]}`;
  const preview = heic
    ? native
      ? await invoke<string>("decode_heic", { data: data.split(",")[1] })
      : undefined
    : undefined;
  if (heic && !preview)
    throw new Error(
      "Import HEIC in the desktop app, or choose PNG / JPEG in the browser preview.",
    );
  const image = await loadImage(preview ?? data);
  if (
    image.width > 8192 ||
    image.height > 8192 ||
    image.width * image.height > 32_000_000
  )
    throw new Error(
      "Use artwork up to 8192 pixels per side and 32 megapixels.",
    );
  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 180),
    mime: heic ? "image/heic" : (file.type as Asset["mime"]),
    ...(preview ? { preview, previewSha256: await sha256(preview) } : {}),
    data,
    sha256: await sha256(data),
    width: image.width,
    height: image.height,
  };
}
function download(content: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function saveProject(
  content: string,
  path: string | null,
  name: string,
): Promise<string | null> {
  if (native) return invoke("save_project", { content, path, name });
  download(content, `${name}.formstudio`, "application/json");
  return "Downloaded project";
}
export async function openProject(): Promise<{
  content: string;
  path: string;
} | null> {
  return native ? invoke("open_project") : null;
}
export async function saveReview(data: string, name: string) {
  if (native) return invoke<string | null>("save_review", { data, name });
  const a = document.createElement("a");
  a.href = data;
  a.download = `${name}-review.png`;
  a.click();
  return "Downloaded review";
}

export async function savePattern(
  bytes: Uint8Array,
  name: string,
  format: "svg" | "pdf",
) {
  if (native) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return invoke<string | null>("save_pattern", {
      data: btoa(binary),
      name,
      format,
    });
  }
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], {
      type: format === "pdf" ? "application/pdf" : "image/svg+xml",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-pattern.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "Downloaded pattern";
}

export async function saveTextFile(
  content: string,
  name: string,
  format: "json" | "smis" | "csv",
) {
  if (content.length > 2_000_000) throw new Error("Text export exceeds 2 MB.");
  if (native)
    return invoke<string | null>("save_text_file", { content, name, format });
  download(
    content,
    `${name}.${format}`,
    format === "json"
      ? "application/json"
      : format === "smis"
        ? "application/xml"
        : "text/csv",
  );
  return "Downloaded file";
}

export async function savePortfolio(bytes: Uint8Array, name: string) {
  if (bytes.length > 50000000) throw new Error("Portfolio exceeds 50 MB.");
  if (native) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return invoke<string | null>("save_portfolio", {
      data: btoa(binary),
      name,
    });
  }
  const url = URL.createObjectURL(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name + "-portfolio.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "Downloaded portfolio";
}
