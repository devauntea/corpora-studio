"""MakeHuman hm08 (CC0) loader for the revision-6 anatomy pipeline.

Build-time NumPy only. Coordinates are MakeHuman decimetres: +Y up, +Z anterior,
+X is the model's LEFT side (".L" bones). Nothing here is shipped to the app.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/anatomy/source"


@lru_cache(maxsize=1)
def base_mesh():
    """Return all hm08 vertices (including helpers), UVs, and per-group faces."""
    verts, uvs = [], []
    groups: dict[str, list[tuple[list[int], list[int]]]] = {}
    group = ""
    for line in (SOURCE / "base.obj").read_text().splitlines():
        s = line.split()
        if not s:
            continue
        if s[0] == "v":
            verts.append([float(x) for x in s[1:4]])
        elif s[0] == "vt":
            uvs.append([float(x) for x in s[1:3]])
        elif s[0] == "g":
            group = s[1]
        elif s[0] == "f":
            vi = [int(x.split("/")[0]) - 1 for x in s[1:]]
            ti = [int(x.split("/")[1]) - 1 for x in s[1:]]
            groups.setdefault(group, []).append((vi, ti))
    return np.array(verts), np.array(uvs), groups


def body_faces():
    _, _, groups = base_mesh()
    return [f for f, _ in groups["body"]], [t for _, t in groups["body"]]


@lru_cache(maxsize=None)
def target(name: str) -> np.ndarray:
    verts, _, _ = base_mesh()
    d = np.zeros_like(verts)
    for line in (SOURCE / name).read_text().splitlines():
        s = line.split()
        if len(s) == 4 and s[0].isdigit():
            d[int(s[0])] = [float(x) for x in s[1:]]
    return d


def shape(sex: str, build: str) -> np.ndarray:
    """MakeHuman artist targets only, with no procedural sculpt layers.

    Matches the target mix used by revisions 2-5 (scripts/build-detailed-anatomy.py)
    so differences against revision 5 isolate the later procedural layers.
    """
    verts, _, _ = base_mesh()
    macro = target(f"caucasian-{sex}-young.target")
    if build == "average":
        neutral = target(f"universal-{sex}-young-averagemuscle-averageweight.target")
        fat = target(f"universal-{sex}-young-averagemuscle-maxweight.target")
        return verts + macro + neutral + fat * 0.20
    bulk = target(f"universal-{sex}-young-maxmuscle-averageweight.target")
    out = verts + macro + bulk
    details = {
        "stomach-tone-incr.target": 0.85 if sex == "male" else 0.55,
        "torso-muscle-pectoral-incr.target": 0.15 if sex == "male" else 0.05,
        "torso-muscle-dorsi-incr.target": 0.35,
    }
    for side in "lr":
        for part in ["upperarm", "lowerarm", "upperleg", "lowerleg", "upperarm-shoulder"]:
            details[f"{side}-{part}-muscle-incr.target"] = 0.25 if sex == "male" else 0.12
    for name, amount in details.items():
        out = out + target(name) * amount
    return out


@lru_cache(maxsize=1)
def skeleton():
    return json.loads((SOURCE / "default.mhskel").read_text())


@lru_cache(maxsize=1)
def skin_weights():
    return json.loads((SOURCE / "default_weights.mhw").read_text())["weights"]


def joint_positions(v: np.ndarray) -> dict[str, np.ndarray]:
    """MakeHuman joint = centroid of its helper/reference vertices on the morphed mesh."""
    sk = skeleton()
    return {name: v[idx].mean(axis=0) for name, idx in sk["joints"].items()}


def bones(v: np.ndarray):
    """Bone heads/tails/parents and MakeHuman rotation-plane normals for a shape."""
    sk = skeleton()
    j = joint_positions(v)
    out = {}
    for name, b in sk["bones"].items():
        head, tail = j[b["head"]], j[b["tail"]]
        normal = None
        plane = sk["planes"].get(b["rotation_plane"]) if b.get("rotation_plane") else None
        if plane:
            p1, p2, p3 = (j[n] for n in plane)
            n = np.cross(p2 - p1, p3 - p2)
            normal = n / max(np.linalg.norm(n), 1e-12)
        out[name] = {"head": head, "tail": tail, "parent": b["parent"], "plane_normal": normal}
    return out


def weight_matrix(bone_names: list[str], n_verts: int) -> np.ndarray:
    """Dense (n_verts, n_bones) weight matrix for the given bones, rows normalised."""
    w = np.zeros((n_verts, len(bone_names)))
    index = {b: i for i, b in enumerate(bone_names)}
    for b, pairs in skin_weights().items():
        if b not in index:
            continue
        for vi, wt in pairs:
            if vi < n_verts:
                w[vi, index[b]] += wt
    s = w.sum(axis=1, keepdims=True)
    return np.divide(w, s, out=np.zeros_like(w), where=s > 0)
