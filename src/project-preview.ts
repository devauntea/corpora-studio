import type { Project } from "./domain";
import type { View } from "./scene";
export async function projectPreview(
  p: Project,
  mode: "surface" | "photo" | "pattern",
  view: View = "front",
): Promise<string> {
  if (mode === "pattern") {
    if (!p.fashion) throw new Error("This checkpoint has no fashion draft.");
    const [{ draftFashion }, { patternSvg }, { withSeamNotches }] =
      await Promise.all([
        import("./fashion-draft"),
        import("./fashion-export"),
        import("./seam-checks"),
      ]);
    return URL.createObjectURL(
      new Blob(
        [
          patternSvg(
            withSeamNotches(draftFashion(p.fashion), p.fashion),
            p.fashion,
            p.name,
          ),
        ],
        {
          type: "image/svg+xml",
        },
      ),
    );
  }
  if (mode === "photo") {
    if (!p.photos.length)
      throw new Error("This checkpoint has no body photograph.");
    const { exportPhoto } = await import("./photo");
    return exportPhoto(p, p.photos[0]);
  }
  const { StudioScene } = await import("./scene");
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "800px",
    height: "800px",
    pointerEvents: "none",
  });
  document.body.append(host);
  let scene: InstanceType<typeof StudioScene> | undefined,
    error = "";
  try {
    scene = new StudioScene(host, {
      begin() {},
      move() {},
      end() {},
      stats() {},
      error(s) {
        error = s;
      },
    });
    scene.active = false;
    const ready = await scene.update(p);
    if (!ready) throw new Error(error || "Could not render this checkpoint.");
    scene.view(view, p.body.length);
    return scene.exportReview(p);
  } finally {
    scene?.dispose();
    host.remove();
  }
}
