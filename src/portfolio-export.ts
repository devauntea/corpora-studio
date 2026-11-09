import { strToU8 } from "fflate";
import type { Project } from "./domain";
import { projectPreview } from "./project-preview";
import { loadImage } from "./io";
import indexHtml from "./portfolio-template/index.html?raw";
import styles from "./portfolio-template/style.css?raw";
import script from "./portfolio-template/gallery.js?raw";
export type PortfolioWork = {
  title: string;
  note: string;
  category: "tattoo" | "fashion";
  image: string;
};
export type PortfolioManifest = {
  format: "form-studio-portfolio";
  version: 1;
  title: string;
  description: string;
  works: PortfolioWork[];
  credits: string[];
};
export type PortfolioOptions = {
  title: string;
  description: string;
  surface: boolean;
  pattern: boolean;
  photos: boolean;
  anatomy: boolean;
};
export async function portfolioFiles(
  project: Project,
  options: PortfolioOptions,
  signal?: AbortSignal,
  progress?: (p: number) => void,
) {
  const abort = () => {
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
  };
  const manifest: PortfolioManifest = {
      format: "form-studio-portfolio",
      version: 1,
      title: options.title.trim() || project.name,
      description: options.description,
      works: [],
      credits: [],
    },
    files: Record<string, Uint8Array> = {
      "index.html": strToU8(indexHtml),
      "style.css": strToU8(styles),
      "gallery.js": strToU8(script),
    };
  const captures: {
    title: string;
    note: string;
    category: PortfolioWork["category"];
    render: () => Promise<string>;
  }[] = [];
  if (options.surface)
    for (const view of ["front", "back", "left", "right"] as const)
      captures.push({
        title: `${project.name} · ${view}`,
        note: "Tattoo composition on an approximate body model.",
        category: "tattoo",
        render: () =>
          projectPreview(
            {
              ...project,
              body:
                project.body.kind === "human-v1"
                  ? { ...project.body, anatomy: options.anatomy }
                  : project.body,
            },
            "surface",
            view,
          ),
      });
  if (options.pattern && project.fashion)
    captures.push({
      title: `${project.name} · pattern study`,
      note: "Measurement-driven garment draft. Physical fit has not been validated.",
      category: "fashion",
      render: () => projectPreview(project, "pattern"),
    });
  if (options.photos)
    for (const photo of project.photos)
      captures.push({
        title: `${project.name} · photo study ${captures.filter((c) => c.note.includes("photograph")).length + 1}`,
        note: "Artistic tattoo mockup on a photograph. Not a healed-result prediction.",
        category: "tattoo",
        render: async () => {
          const { exportPhoto } = await import("./photo");
          return exportPhoto(project, photo);
        },
      });
  if (!captures.length)
    throw new Error("Choose at least one available export category.");
  for (const [i, capture] of captures.entries()) {
    abort();
    const url = await capture.render();
    try {
      abort();
      const image = await loadImage(url),
        canvas = document.createElement("canvas"),
        scale = Math.min(1, 2000 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f2f0eb";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Could not render portfolio image.")),
          "image/png",
        ),
      );
      abort();
      const filename = `images/study-${String(i + 1).padStart(2, "0")}.png`;
      files[filename] = new Uint8Array(await blob.arrayBuffer());
      manifest.works.push({
        title: capture.title,
        note: capture.note,
        category: capture.category,
        image: filename,
      });
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
    progress?.((i + 1) / (captures.length + 1));
  }
  if (options.surface)
    manifest.credits.push(
      "Body geometry derived from MakeHuman CC0 graphical assets.",
    );
  if (options.surface && options.anatomy)
    manifest.credits.push(
      "Muscle guide adapted from Z-Anatomy / BodyParts3D, CC BY-SA 4.0. Source: https://github.com/Z-Anatomy/Models-of-human-anatomy · https://creativecommons.org/licenses/by-sa/4.0/",
    );
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["manifest.js"] = strToU8(
    "window.FORM_STUDIO_PORTFOLIO=" + JSON.stringify(manifest) + ";\n",
  );
  files["README.txt"] = strToU8(
    "Corpora Studio portfolio export\nOpen index.html locally, or host this folder as a static website.\nOnly selected flattened review images and display metadata are included. Source images, editable projects and measurement tables are not included as separate files. Review every exported image before sharing; image pixels may contain private details.\n\n" +
      manifest.credits.join("\n"),
  );
  return { files, manifest };
}
