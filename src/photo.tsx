import {
  defaultQuad,
  validQuad,
  drawWarp,
  insideQuad,
  type Quad,
} from "./photo-warp";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  clamp,
  artworkRatio,
  type Asset,
  type Layer,
  type Photo,
  type Project,
} from "./domain";
import { InkCache } from "./ink";

export async function paintPhoto(
  project: Project,
  photo: Photo,
  cache: InkCache,
  max = 2048,
  before = false,
) {
  const asset = project.assets.find((a) => a.id === photo.assetId)!;
  const source = await cache.image(asset),
    scale = Math.min(1, max / Math.max(source.width, source.height));
  const c = document.createElement("canvas");
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const scratch = document.createElement("canvas");
  scratch.width = c.width;
  scratch.height = c.height;
  const x = scratch.getContext("2d")!;
  if (!before)
    for (const l of project.layers.filter(
      (l) => l.photoId === photo.id && l.visible,
    )) {
      const a = project.assets.find((a) => a.id === l.assetId)!,
        image = await cache.get(a, l),
        p = l.photo!;
      const w = p.width * c.width,
        h = w * artworkRatio(a) * (l.stretch ?? 1);
      x.clearRect(0, 0, c.width, c.height);
      if (p.warp) {
        const quad = corners(l, a, c.width / c.height).points.map(([u, v]) => [
          (u * c.width) / 1000,
          (v * c.width) / 1000,
        ]) as Quad;
        drawWarp(x, image, quad);
      } else {
        x.save();
        x.translate(p.x * c.width, p.y * c.height);
        x.rotate((l.rotation * Math.PI) / 180);
        x.transform(l.flipX ? -1 : 1, 0, p.skew, l.flipY ? -1 : 1, 0, 0);
        x.drawImage(image, -w / 2, -h / 2, w, h);
        x.restore();
      }
      x.save();
      x.globalCompositeOperation = "destination-out";
      x.lineCap = "round";
      x.lineJoin = "round";
      for (const stroke of photo.masks) {
        x.lineWidth = stroke.radius * c.width * 2;
        x.beginPath();
        stroke.points.forEach(([u, v], i) =>
          i
            ? x.lineTo(u * c.width, v * c.height)
            : x.moveTo(u * c.width, v * c.height),
        );
        if (stroke.points.length === 1) {
          x.arc(
            stroke.points[0][0] * c.width,
            stroke.points[0][1] * c.height,
            stroke.radius * c.width,
            0,
            Math.PI * 2,
          );
          x.fill();
        } else x.stroke();
      }
      x.restore();
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = l.blend ?? "multiply";
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    }
  cache.prune(
    project.assets,
    project.layers.filter((l) => l.photoId === photo.id && l.visible),
  );
  return c;
}
export async function exportPhoto(project: Project, photo: Photo) {
  const cache = new InkCache();
  try {
    const source = await paintPhoto(project, photo, cache, 4000),
      c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height + 100;
    const x = c.getContext("2d")!;
    x.fillStyle = "#eeeae1";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(source, 0, 0);
    x.fillStyle = "#243c31";
    x.font = `${Math.max(14, Math.min(28, c.width / 45))}px sans-serif`;
    x.fillText(
      `FORM / STUDIO · ${project.name.slice(0, 60)}`,
      24,
      source.height + 40,
    );
    x.fillText(
      "Artistic photo preview · Uncalibrated scale / ink · Not a tattoo stencil",
      24,
      source.height + 76,
    );
    return c.toDataURL("image/png");
  } finally {
    cache.clear();
  }
}
function corners(l: Layer, a: Asset, aspect: number) {
  const p = l.photo!,
    w = p.width * 1000,
    h = w * artworkRatio(a) * (l.stretch ?? 1),
    t = (l.rotation * Math.PI) / 180;
  const point = (u: number, v: number): [number, number] => {
    const x = (l.flipX ? -1 : 1) * u * w + p.skew * v * h,
      y = (l.flipY ? -1 : 1) * v * h;
    return [
      p.x * 1000 + x * Math.cos(t) - y * Math.sin(t),
      (p.y * 1000) / aspect + x * Math.sin(t) + y * Math.cos(t),
    ];
  };
  const q = p.warp ?? defaultQuad(),
    u = (q[0][0] + q[1][0]) / 2,
    v = (q[0][1] + q[1][1]) / 2;
  return {
    points: q.map(([x, y]) => point(x, y)) as Quad,
    top: point(u, v),
    rotate: point(u, v - 38 / h),
  };
}
export function PhotoStage({
  project,
  photo,
  selected,
  onSelect,
  onLayer,
  onPhoto,
  begin,
  end,
  onError,
}: {
  project: Project;
  photo: Photo;
  selected?: string;
  onSelect: (id: string) => void;
  onLayer: (patch: Partial<Layer>) => void;
  onPhoto: (photo: Photo) => void;
  begin: () => void;
  end: () => void;
  onError: (message: string) => void;
}) {
  const [before, setBefore] = useState(false),
    [protect, setProtect] = useState(false),
    [warp, setWarp] = useState(false),
    [brush, setBrush] = useState(0.025),
    [size, setSize] = useState({ width: 1, height: 1 });
  const [draft, setDraft] = useState<Photo["masks"][number]>();
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    cache = useRef(new InkCache());
  const drag = useRef<
    | {
        action: string;
        start: [number, number];
        layer: Layer;
        angle: number;
        distance: number;
      }
    | undefined
  >(undefined);
  const stroke = useRef<Photo["masks"][number] | undefined>(undefined);
  const a = project.assets.find((a) => a.id === photo.assetId)!,
    aspect = a.width / a.height;
  const layer = project.layers.find(
      (l) => l.id === selected && l.photoId === photo.id,
    ),
    art = project.assets.find((a) => a.id === layer?.assetId);
  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const w = Math.min(width, height * aspect);
      setSize({ width: w, height: w / aspect });
    });
    if (host.current) resize.observe(host.current);
    return () => resize.disconnect();
  }, [aspect]);
  useEffect(() => {
    let cancelled = false;
    void paintPhoto(project, photo, cache.current, 2048, before)
      .then((c) => {
        if (!cancelled && canvas.current) {
          canvas.current.width = c.width;
          canvas.current.height = c.height;
          canvas.current.getContext("2d")!.drawImage(c, 0, 0);
        }
      })
      .catch(() =>
        onError(
          "This photo preview could not be rendered. Original files are preserved.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [project, photo, before, onError]);
  useEffect(() => {
    return () => cache.current.clear();
  }, []);
  const xy = (e: ReactPointerEvent<SVGSVGElement>): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    return [
      clamp((e.clientX - b.left) / b.width, 0, 1),
      clamp((e.clientY - b.top) / b.height, 0, 1),
    ];
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || before) return;
    const p = xy(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (protect) {
      if (photo.masks.length >= 200) {
        onError(
          "This photo has reached 200 protection strokes. Undo or clear its mask.",
        );
        return;
      }
      stroke.current = { radius: brush, points: [p] };
      setDraft(stroke.current);
      return;
    }
    const action = (e.target as SVGElement).dataset.action;
    let target = layer;
    if (!action) {
      target = [...project.layers].reverse().find((l) => {
        if (l.photoId !== photo.id || !l.visible || l.locked) return false;
        const a = project.assets.find((a) => a.id === l.assetId)!;
        return insideQuad(
          [p[0] * 1000, (p[1] * 1000) / aspect],
          corners(l, a, aspect).points,
        );
      });
    }
    if (!target || target.locked) return;
    onSelect(target.id);
    begin();
    const ph = target.photo!,
      dx = p[0] - ph.x,
      dy = (p[1] - ph.y) / aspect;
    drag.current = {
      action: action ?? "move",
      start: p,
      layer: target,
      angle: Math.atan2(dy, dx),
      distance: Math.hypot(dx, dy),
    };
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = xy(e);
    if (stroke.current) {
      if (stroke.current.points.length < 2000) {
        stroke.current = {
          ...stroke.current,
          points: [...stroke.current.points, p],
        };
        setDraft(stroke.current);
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    const ph = d.layer.photo!,
      dx = p[0] - ph.x,
      dy = (p[1] - ph.y) / aspect;
    if (d.action.startsWith("warp-")) {
      const asset = project.assets.find((a) => a.id === d.layer.assetId)!;
      const t = (-d.layer.rotation * Math.PI) / 180,
        ry = dx * Math.sin(t) + dy * Math.cos(t),
        rx = dx * Math.cos(t) - dy * Math.sin(t);
      const y = ry / (d.layer.flipY ? -1 : 1),
        x = (rx - ph.skew * y) / (d.layer.flipX ? -1 : 1);
      const q = structuredClone(ph.warp ?? defaultQuad());
      q[Number(d.action.slice(5))] = [
        clamp(x / ph.width, -1.5, 1.5),
        clamp(
          y / (ph.width * artworkRatio(asset) * (d.layer.stretch ?? 1)),
          -1.5,
          1.5,
        ),
      ];
      if (validQuad(q)) onLayer({ photo: { ...ph, warp: q } });
    } else if (d.action === "rotate") {
      const deg =
        d.layer.rotation + ((Math.atan2(dy, dx) - d.angle) * 180) / Math.PI;
      onLayer({ rotation: ((deg + 540) % 360) - 180 });
    } else if (d.action === "scale")
      onLayer({
        photo: {
          ...ph,
          width: clamp(
            (ph.width * Math.hypot(dx, dy)) / Math.max(0.001, d.distance),
            0.01,
            2,
          ),
        },
      });
    else
      onLayer({
        photo: {
          ...ph,
          x: clamp(ph.x + p[0] - d.start[0], 0, 1),
          y: clamp(ph.y + p[1] - d.start[1], 0, 1),
        },
      });
  };
  const up = () => {
    if (stroke.current) {
      const count = project.photos.reduce(
        (n, ph) => n + ph.masks.reduce((n, s) => n + s.points.length, 0),
        0,
      );
      if (count + stroke.current.points.length > 80_000)
        onError(
          "This project reached its protection-point budget. Undo or clear a photo mask.",
        );
      else onPhoto({ ...photo, masks: [...photo.masks, stroke.current] });
      stroke.current = undefined;
      setDraft(undefined);
    }
    if (drag.current) {
      drag.current = undefined;
      end();
    }
  };
  const handles =
    layer && art && layer.visible && !layer.locked
      ? corners(layer, art, aspect)
      : undefined;
  return (
    <div className="photo-workspace">
      <div className="photo-toolbar">
        <button
          className={!protect && !warp ? "selected" : ""}
          onClick={() => {
            setProtect(false);
            setWarp(false);
          }}
        >
          Transform
        </button>
        <button
          className={warp && !protect ? "selected" : ""}
          aria-pressed={warp && !protect}
          onClick={() => {
            setWarp(true);
            setProtect(false);
          }}
        >
          Warp corners
        </button>
        {warp && (
          <button
            disabled={!layer?.photo?.warp || layer.locked}
            onClick={() => {
              if (layer?.photo)
                onLayer({ photo: { ...layer.photo, warp: undefined } });
            }}
          >
            Reset warp
          </button>
        )}
        <button
          className={protect ? "selected" : ""}
          onClick={() => setProtect(true)}
        >
          Protect existing ink
        </button>
        <button aria-pressed={before} onClick={() => setBefore(!before)}>
          {before ? "Show composition" : "Show original"}
        </button>
      </div>
      {protect && (
        <div className="photo-mask-tools">
          <label>
            Brush{" "}
            <input
              aria-label="Protection brush size"
              type="range"
              min=".005"
              max=".1"
              step=".005"
              value={brush}
              onChange={(e) => setBrush(+e.target.value)}
            />
          </label>
          <button
            disabled={!photo.masks.length}
            onClick={() => onPhoto({ ...photo, masks: [] })}
          >
            Clear protection
          </button>
          <span>Paint areas that new ink must avoid.</span>
        </div>
      )}
      <div ref={host} className="photo-fit">
        <div className="photo-board" style={size}>
          <canvas ref={canvas} aria-label="Photo composition preview" />
          <svg
            aria-label="Photo placement controls"
            tabIndex={0}
            viewBox={`0 0 1000 ${1000 / aspect}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            style={{ cursor: protect ? "crosshair" : "default" }}
          >
            {!before &&
              protect &&
              [...photo.masks, ...(draft ? [draft] : [])].map((s, i) => (
                <path
                  key={i}
                  d={
                    s.points
                      .map(
                        ([x, y], j) =>
                          `${j ? "L" : "M"} ${x * 1000} ${(y * 1000) / aspect}`,
                      )
                      .join(" ") + (s.points.length === 1 ? " l .01 .01" : "")
                  }
                  stroke="rgba(181,80,65,.4)"
                  strokeWidth={s.radius * 2000}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  pointerEvents="none"
                />
              ))}
            {!before && !protect && handles && (
              <g className="photo-handles">
                <polygon
                  points={handles.points.map((p) => p.join(",")).join(" ")}
                  fill="transparent"
                  stroke="#fff"
                  strokeWidth="2"
                  data-action="move"
                />
                <line
                  x1={handles.top[0]}
                  y1={handles.top[1]}
                  x2={handles.rotate[0]}
                  y2={handles.rotate[1]}
                  stroke="#fff"
                  strokeWidth="2"
                />
                {handles.points.map(([x, y], i) => (
                  <rect
                    key={i}
                    x={x - 8}
                    y={y - 8}
                    width="16"
                    height="16"
                    fill="#333"
                    stroke="#fff"
                    strokeWidth="2"
                    data-action={warp ? `warp-${i}` : "scale"}
                  />
                ))}
                <circle
                  cx={handles.rotate[0]}
                  cy={handles.rotate[1]}
                  r="10"
                  fill="#333"
                  stroke="#fff"
                  strokeWidth="2"
                  data-action="rotate"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
      <div className="photo-caption">
        {a.name} <span>·</span>{" "}
        {before
          ? "Original photograph"
          : protect
            ? "Protection is anchored to this photograph"
            : warp
              ? "Drag corners to fit perspective · Foldovers are prevented"
              : "Drag artwork · Corner handles scale · Round handle rotates"}
        <small>Artistic preview · Photograph scale is not calibrated</small>
      </div>
    </div>
  );
}
