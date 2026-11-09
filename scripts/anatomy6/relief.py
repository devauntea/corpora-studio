"""Atlas-registered muscle relief for body revision 7 (build-time NumPy/SciPy).

Inter-muscular grooves are placed on the actual borders of the registered
Z-Anatomy / BodyParts3D muscle field (CC BY-SA 4.0 adaptation), not at hand-
placed world coordinates. Depth depends on which two muscles meet, on build
(fit vs average) and on sex. Subcutaneous bony landmarks are enforced as
minimum skin offsets over joint-frame ellipsoids derived from the CC0
MakeHuman skeleton. These are authored visual approximations, not measured
anatomy.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import dijkstra

ROOT = Path(__file__).resolve().parents[2]
ANATOMY = ROOT / "public/anatomy"
CONNECTIVE = 36

GROUPS = [
    "Pectoralis major", "Rectus abdominis", "External oblique", "Serratus anterior",
    "Trapezius", "Latissimus dorsi", "Infraspinatus", "Teres major", "Deltoid",
    "Biceps brachii", "Triceps brachii", "Brachialis", "Brachioradialis",
    "Pronator teres", "Flexor carpi radialis", "Flexor carpi ulnaris",
    "Palmaris longus", "Finger flexors", "Extensor digitorum",
    "Extensor carpi radialis", "Extensor carpi ulnaris", "Thumb extensors",
    "Rectus femoris", "Vastus lateralis", "Vastus medialis", "Sartorius",
    "Adductors", "Tensor fasciae latae", "Hamstrings", "Gastrocnemius", "Soleus",
    "Tibialis anterior", "Fibularis", "Gluteus", "Sternocleidomastoid",
    "Spinal extensors",
]
G = {name: i for i, name in enumerate(GROUPS)}

# (muscle a, muscle b): groove depth (mm) and half-width (mm) for a fit male.
# Values are visual targets chosen against anatomical drawings, not measurements.
PAIRS = {
    ("Deltoid", "Pectoralis major"): (3.2, 9),
    ("Deltoid", "Biceps brachii"): (2.6, 11),
    ("Deltoid", "Triceps brachii"): (3.0, 11),
    ("Deltoid", "Brachialis"): (2.4, 10),
    ("Deltoid", "Trapezius"): (1.8, 10),
    ("Deltoid", "Infraspinatus"): (2.4, 10),
    ("Deltoid", "Teres major"): (2.0, 9),
    ("Biceps brachii", "Triceps brachii"): (2.0, 9),
    ("Biceps brachii", "Brachialis"): (1.8, 8),
    ("Triceps brachii", "Brachialis"): (1.6, 8),
    ("Biceps brachii", "Brachioradialis"): (1.8, 8),
    ("Brachialis", "Brachioradialis"): (1.6, 8),
    ("Brachioradialis", "Extensor carpi radialis"): (1.0, 6),
    ("Brachioradialis", "Flexor carpi radialis"): (1.2, 7),
    ("Brachioradialis", "Pronator teres"): (1.4, 7),
    ("Flexor carpi ulnaris", "Extensor carpi ulnaris"): (1.5, 7),
    ("Triceps brachii", "Teres major"): (1.8, 9),
    ("Triceps brachii", "Latissimus dorsi"): (1.6, 9),
    ("Infraspinatus", "Teres major"): (2.0, 9),
    ("Infraspinatus", "Trapezius"): (1.8, 11),
    ("Teres major", "Latissimus dorsi"): (1.8, 10),
    ("Latissimus dorsi", "Spinal extensors"): (2.2, 13),
    ("Trapezius", "Latissimus dorsi"): (1.6, 11),
    ("Trapezius", "Spinal extensors"): (1.2, 11),
    ("Latissimus dorsi", "External oblique"): (1.4, 11),
    ("Pectoralis major", "Serratus anterior"): (1.8, 9),
    ("Serratus anterior", "External oblique"): (1.6, 8),
    ("Serratus anterior", "Latissimus dorsi"): (1.6, 9),
    ("Rectus abdominis", "External oblique"): (1.8, 11),
    ("Sternocleidomastoid", "Trapezius"): (1.6, 9),
    ("Rectus femoris", "Vastus lateralis"): (2.6, 11),
    ("Rectus femoris", "Vastus medialis"): (2.4, 11),
    ("Vastus medialis", "Sartorius"): (2.6, 10),
    ("Rectus femoris", "Sartorius"): (2.2, 10),
    ("Sartorius", "Adductors"): (1.8, 10),
    ("Rectus femoris", "Tensor fasciae latae"): (2.2, 10),
    ("Vastus lateralis", "Tensor fasciae latae"): (1.6, 11),
    ("Vastus lateralis", "Hamstrings"): (2.2, 12),
    ("Hamstrings", "Adductors"): (1.6, 11),
    ("Gluteus", "Hamstrings"): (2.0, 13),
    ("Gluteus", "Tensor fasciae latae"): (1.6, 11),
    ("Gastrocnemius", "Soleus"): (2.6, 10),
    ("Tibialis anterior", "Fibularis"): (1.6, 8),
    ("Tibialis anterior", "Soleus"): (1.2, 8),
    ("Fibularis", "Soleus"): (1.4, 9),
    ("Gastrocnemius", "Hamstrings"): (1.4, 9),
}


def load(revision: int, sex: str):
    meta = json.loads((ANATOMY / f"human-v{revision}-{sex}.json").read_text())
    raw = (ANATOMY / meta["buffer"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta["sha256"]
    n = meta["vertexCount"]
    data = np.frombuffer(raw[: n * 48], "<f4").reshape(n, 12).astype(np.float64)
    tris = np.frombuffer(raw[n * 48:], "<u4").reshape(-1, 3).astype(np.int64)
    field = np.frombuffer((ANATOMY / f"muscle-field-v{revision}-{sex}.bin").read_bytes(), np.uint8)
    infl = field[n * 4:].reshape(n, 8)
    return meta, raw, data, tris, infl


def unique_tris(tris: np.ndarray) -> np.ndarray:
    key = np.sort(tris, axis=1)
    _, idx = np.unique(key, axis=0, return_index=True)
    return tris[np.sort(idx)]


def normals(v: np.ndarray, tris: np.ndarray) -> np.ndarray:
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def adjacency(v: np.ndarray, tris: np.ndarray) -> sp.csr_matrix:
    e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
    e = np.unique(np.sort(e, axis=1), axis=0)
    length = np.linalg.norm(v[e[:, 0]] - v[e[:, 1]], axis=1)
    n = len(v)
    a = sp.coo_matrix((length, (e[:, 0], e[:, 1])), shape=(n, n))
    return (a + a.T).tocsr()


def smoothed_labels(infl: np.ndarray, A: sp.csr_matrix, iterations: int = 6) -> np.ndarray:
    """Dominant group after a few rounds of neighbour averaging of categorical weights."""
    n = len(infl)
    prob = np.zeros((n, CONNECTIVE + 1), np.float32)
    for k in range(4):
        np.add.at(prob, (np.arange(n), infl[:, k]), infl[:, 4 + k].astype(np.float32))
    B = (A > 0).astype(np.float32)
    deg = np.asarray(B.sum(axis=1)).ravel()
    for _ in range(iterations):
        prob = 0.5 * prob + 0.5 * (B @ prob) / np.maximum(deg, 1)[:, None]
    return prob.argmax(axis=1)


def groove_field(v: np.ndarray, tris: np.ndarray, labels: np.ndarray, A: sp.csr_matrix, scale: float):
    """Signed normal displacement (dm) carving grooves along registered muscle borders."""
    coo = A.tocoo()
    diff = labels[coo.row] != labels[coo.col]
    other = np.full(len(v), -1)
    other[coo.row[diff]] = labels[coo.col[diff]]
    boundary = np.flatnonzero(other >= 0)
    depth_at = np.zeros(len(v))
    width_at = np.zeros(len(v))
    for i in boundary:
        a, b = GROUPS[labels[i]] if labels[i] < CONNECTIVE else None, GROUPS[other[i]] if other[i] < CONNECTIVE else None
        spec = PAIRS.get((a, b)) or PAIRS.get((b, a))
        if spec:
            depth_at[i], width_at[i] = spec
    sources = boundary[depth_at[boundary] > 0]
    dist, _, src = dijkstra(A, directed=False, indices=sources, min_only=True, limit=0.45, return_predecessors=True)
    reach = np.isfinite(dist) & (src >= 0)
    depth = np.zeros(len(v))
    s = src[reach]
    w = width_at[s] / 100.0  # mm -> dm
    depth[reach] = depth_at[s] / 100.0 * np.exp(-((dist[reach] / w) ** 2))
    return -depth * scale


def smooth_field(f: np.ndarray, A: sp.csr_matrix, iterations: int) -> np.ndarray:
    B = (A > 0).astype(np.float64)
    deg = np.maximum(np.asarray(B.sum(axis=1)).ravel(), 1)
    for _ in range(iterations):
        f = 0.5 * f + 0.5 * (B @ f) / deg
    return f


def lipped_groove(dist: np.ndarray, depth: np.ndarray, width: np.ndarray) -> np.ndarray:
    """Groove with rounded muscle edges: a septum flanked by slightly raised bellies."""
    groove = np.exp(-((dist / width) ** 2))
    lip = 0.30 * np.exp(-(((dist - 1.7 * width) / (1.1 * width)) ** 2))
    return depth * (lip - groove)


def groove_field2(v, labels, A, extra_boundaries=None):
    """Like groove_field but with rounded lips and optional authored sub-borders.

    extra_boundaries: list of (mask_of_seed_vertices, depth_mm, width_mm).
    """
    coo = A.tocoo()
    diff = labels[coo.row] != labels[coo.col]
    other = np.full(len(v), -1)
    other[coo.row[diff]] = labels[coo.col[diff]]
    depth_at = np.zeros(len(v))
    width_at = np.zeros(len(v))
    for i in np.flatnonzero(other >= 0):
        a = GROUPS[labels[i]] if labels[i] < CONNECTIVE else None
        b = GROUPS[other[i]] if other[i] < CONNECTIVE else None
        spec = PAIRS.get((a, b)) or PAIRS.get((b, a))
        if spec:
            depth_at[i], width_at[i] = spec
    for seeds, d, w in extra_boundaries or []:
        stronger = seeds & (depth_at < d)
        depth_at[stronger], width_at[stronger] = d, w
    sources = np.flatnonzero(depth_at > 0)
    dist, _, src = dijkstra(A, directed=False, indices=sources, min_only=True, limit=0.6, return_predecessors=True)
    reach = np.isfinite(dist) & (src >= 0)
    out = np.zeros(len(v))
    s = src[reach]
    out[reach] = lipped_groove(dist[reach], depth_at[s] / 100.0, width_at[s] / 100.0)
    return out


def iso_seeds(field: np.ndarray, A: sp.csr_matrix, level: float, mask: np.ndarray) -> np.ndarray:
    """Vertices where a scalar field crosses `level` inside `mask` (authored sub-borders)."""
    coo = A.tocoo()
    cross = ((field[coo.row] - level) * (field[coo.col] - level) <= 0) & mask[coo.row] & mask[coo.col]
    seeds = np.zeros(len(field), bool)
    seeds[coo.row[cross]] = True
    return seeds


def ellipsoid_push(p: np.ndarray, center, frame, radii, clearance, band, reach):
    """Keep skin at least `clearance` outside an ellipsoid (smooth max). Returns displacement."""
    d_local = (p - center) @ frame  # columns of frame are ellipsoid axes
    near = np.linalg.norm(d_local / radii, axis=1) < reach
    out = np.zeros_like(p)
    if not near.any():
        return out
    q = d_local[near]
    k0 = np.linalg.norm(q / radii, axis=1)
    k1 = np.linalg.norm(q / (radii * radii), axis=1)
    sdf = k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    grad = (q / (radii * radii)) @ frame.T
    grad /= np.maximum(np.linalg.norm(grad, axis=1, keepdims=True), 1e-9)
    # Smooth max(sdf, clearance) with a softplus of width `band`.
    target = clearance + band * np.log1p(np.exp(np.clip((sdf - clearance) / band, -40, 40)))
    target = np.maximum(target, sdf)
    fade = np.clip((reach - k0) / (0.35 * reach), 0, 1)
    out[near] = grad * ((target - sdf) * fade)[:, None]
    return out


def frame_from(axis_main, hint):
    """Orthonormal frame: column 0 = outward axis, column 1 = along limb, column 2 = their cross."""
    a = axis_main / np.linalg.norm(axis_main)
    b = hint - a * (hint @ a)
    b /= np.linalg.norm(b)
    c = np.cross(a, b)
    return np.stack([a, b, c], axis=1)


def skin_extent(p, origin, direction, along, slab=0.18, cone=0.35):
    """Furthest skin distance from `origin` along `direction` within a thin slab around the limb plane."""
    rel = p - origin
    t = rel @ direction
    lat = rel - np.outer(t, direction)
    ok = (np.abs(rel @ along) < slab) & (np.linalg.norm(lat - np.outer(lat @ along, along), axis=1) < cone * np.maximum(t, 1e-6)) & (t > 0)
    return t[ok].max() if ok.any() else None


def _unit(v):
    return v / np.linalg.norm(v)


def _perp(v, axis):
    return _unit(v - axis * (v @ axis))


# Landmark specs: (name, joint, direction key, offset along limb (dm), radii (out, along, across) dm, protrusion mm)
LANDMARKS = [
    ("patella", "knee", "anterior", -0.10, (0.10, 0.24, 0.22), 2.6),
    ("tibial tuberosity", "knee", "anterior", 0.62, (0.06, 0.12, 0.10), 1.6),
    ("patellar tendon", "knee", "anterior", 0.33, (0.05, 0.26, 0.085), 0.9),
    ("olecranon", "elbow", "posterior", 0.06, (0.10, 0.16, 0.12), 2.6),
    ("medial epicondyle", "elbow", "medial", 0.0, (0.08, 0.10, 0.10), 2.0),
    ("lateral epicondyle", "elbow", "lateral", 0.0, (0.06, 0.09, 0.09), 1.0),
    ("medial malleolus", "ankle", "medial", -0.10, (0.07, 0.12, 0.09), 2.4),
    ("lateral malleolus", "ankle", "lateral", 0.02, (0.07, 0.13, 0.08), 2.4),
]


def landmark_field(p: np.ndarray, nrm: np.ndarray, joints: dict, scale: float) -> np.ndarray:
    """Exact-height normal relief over subcutaneous bony landmarks (both sides).

    Each landmark is a smooth plateau (1-k^2)^2 on an ellipsoidal footprint
    centred on the skin point found along the landmark direction in the joint
    frame, so the protrusion equals the authored millimetres.
    """
    out = np.zeros(len(p))
    z = np.array([0.0, 0.0, 1.0])
    for side, sign in (("L", 1.0), ("R", -1.0)):
        j = {k: np.array(v) for k, v in joints[side].items()}
        limbs = {
            "elbow": _unit(j["elbow"] - j["shoulder"]),
            "knee": _unit(j["knee"] - j["hip"]),
            "ankle": _unit(j["ankle"] - j["knee"]),
        }
        for name, joint, key, offset, radii, protrusion in LANDMARKS:
            u = limbs[joint]
            anterior = _perp(z, u)
            medial = _unit(np.cross(u, anterior))
            if medial[0] * sign > 0:
                medial = -medial
            direction = {"anterior": anterior, "posterior": -anterior, "medial": medial, "lateral": -medial}[key]
            origin = j[joint] + u * offset
            skin = skin_extent(p, origin, direction, u)
            if skin is None:
                continue
            centre = origin + direction * skin
            rel = p - centre
            ro, ra, rc = radii
            across = _unit(np.cross(direction, u))
            k2 = (rel @ u / ra) ** 2 + (rel @ across / rc) ** 2 + (rel @ direction / (2.2 * ro)) ** 2
            f = np.clip(1 - k2, 0, None) ** 2
            facing = np.clip(nrm @ direction, 0, 1)
            out += protrusion / 100.0 * scale * f * facing
    return out


# Belly fullness (mm) and rounding radius (mm) per muscle for a fit male.
# Bellies rise from the muscle's own registered borders, so they stay inside it.
BELLIES = {
    "Deltoid": (2.6, 22), "Biceps brachii": (2.8, 18), "Triceps brachii": (2.4, 20),
    "Brachioradialis": (1.6, 12), "Pectoralis major": (1.6, 30), "Trapezius": (1.2, 26),
    "Latissimus dorsi": (1.4, 30), "Infraspinatus": (1.4, 18), "Teres major": (1.2, 12),
    "Rectus femoris": (2.4, 20), "Vastus lateralis": (2.6, 26), "Vastus medialis": (3.2, 18),
    "Sartorius": (0.8, 8), "Gastrocnemius": (3.0, 20), "Soleus": (1.4, 14),
    "Tibialis anterior": (1.4, 12), "Hamstrings": (1.8, 24), "Gluteus": (1.6, 30),
}


def belly_field(labels: np.ndarray, A: sp.csr_matrix) -> np.ndarray:
    """Rounded convex bellies: amplitude * (1 - exp(-(d/r)^2)), d = surface distance to own border."""
    coo = A.tocoo()
    border = np.zeros(len(labels), bool)
    border[coo.row[labels[coo.row] != labels[coo.col]]] = True
    out = np.zeros(len(labels))
    for name, (amp, radius) in BELLIES.items():
        g = G[name]
        inside = labels == g
        if not inside.any():
            continue
        sub = np.flatnonzero(inside)
        local = A[sub][:, sub]
        sources = np.flatnonzero(border[sub])
        if not len(sources):
            continue
        d = dijkstra(local, directed=False, indices=sources, min_only=True, limit=radius / 25.0)
        d = np.nan_to_num(d, posinf=radius / 25.0)
        out[sub] = amp / 100.0 * (1 - np.exp(-((d / (radius / 100.0)) ** 2)))
    return out
