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
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PNG or JPEG image.");
  if (file.size > 15_000_000)
    throw new Error("Choose an image smaller than 15 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(data);
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
    mime: file.type as Asset["mime"],
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
