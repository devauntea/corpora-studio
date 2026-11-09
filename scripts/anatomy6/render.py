"""Small offline orthographic renderer for anatomy review (build-time only).

Painter's-algorithm polygons via Pillow with smooth-normal shading. It is a
geometry inspection tool, not the application renderer: final comparison
renders come from the app itself.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

VIEWS = {"front": 0.0, "left": 90.0, "back": 180.0, "right": -90.0}


def vertex_normals(v: np.ndarray, tris: np.ndarray) -> np.ndarray:
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def triangulate(faces) -> np.ndarray:
    tris = []
    for f in faces:
        for j in range(1, len(f) - 1):
            tris.append((f[0], f[j], f[j + 1]))
    return np.array(tris, dtype=np.int64)


def render(
    v: np.ndarray,
    tris: np.ndarray,
    view: str | float = "front",
    size: tuple[int, int] = (900, 1100),
    bounds: tuple[np.ndarray, np.ndarray] | None = None,
    colors: np.ndarray | None = None,
    pitch: float = 0.0,
    label: str | None = None,
) -> Image.Image:
    yaw = math.radians(VIEWS[view] if isinstance(view, str) else view)
    pitch = math.radians(pitch)
    # Camera looks along -forward; forward points from target toward camera.
    forward = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)])
    up0 = np.array([0.0, 1.0, 0.0])
    right = np.cross(up0, forward)
    right /= np.linalg.norm(right)
    up = np.cross(forward, right)
    used = np.unique(tris)
    lo, hi = bounds if bounds is not None else (v[used].min(0), v[used].max(0))
    center = (lo + hi) / 2
    corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]) - center
    extent_x = np.abs(corners @ right).max() * 2
    extent_y = np.abs(corners @ up).max() * 2
    w, h = size
    scale = 0.9 * min(w / extent_x, h / extent_y)
    p = v - center
    sx = w / 2 + (p @ right) * scale
    sy = h / 2 - (p @ up) * scale
    depth = p @ forward

    n = vertex_normals(v, tris)
    # Studio lights in camera space: key (upper-left-front), fill (right), rim (behind).
    def cam(dx, dy, dz):
        d = dx * right + dy * up + dz * forward
        return d / np.linalg.norm(d)

    lights = [(cam(-0.55, 0.65, 0.75), 0.80), (cam(0.75, 0.15, 0.6), 0.32), (cam(0.0, 0.4, -1.0), 0.28)]
    lum = np.full(len(v), 0.16)
    for d, k in lights:
        lum += k * np.clip(n @ d, 0, None)
    half = cam(-0.3, 0.35, 1.0)
    lum += 0.10 * np.clip(n @ half, 0, None) ** 24
    base = np.array([0.80, 0.77, 0.74]) if colors is None else colors
    rgb = np.clip(base * lum[:, None] if base.ndim == 2 else base[None, :] * lum[:, None], 0, 1) ** (1 / 1.25)

    fd = depth[tris].mean(axis=1)
    facing = ((n[tris].mean(axis=1)) @ forward) > -0.35
    order = np.argsort(fd)
    order = order[facing[order]]
    img = Image.new("RGB", size, (40, 40, 43))
    draw = ImageDraw.Draw(img)
    fc = (rgb[tris].mean(axis=1) * 255).astype(np.uint8)
    xs, ys = sx[tris], sy[tris]
    for i in order:
        draw.polygon([(xs[i, 0], ys[i, 0]), (xs[i, 1], ys[i, 1]), (xs[i, 2], ys[i, 2])], fill=tuple(fc[i]))
    if label:
        draw.text((14, 12), label, fill=(220, 220, 220), font=ImageFont.load_default())
    return img


def sheet(images: list[Image.Image], columns: int, path: Path):
    w, h = images[0].size
    rows = math.ceil(len(images) / columns)
    out = Image.new("RGB", (w * columns, h * rows), (30, 30, 32))
    for i, im in enumerate(images):
        out.paste(im, ((i % columns) * w, (i // columns) * h))
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    return path
