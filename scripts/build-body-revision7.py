"""Body revision 7: atlas-registered muscle separation and bony landmarks.

Reads immutable revision 6 assets and preserves every index, rig weight, chart
position and categorical muscle identity. Only positions change:
- grooves with rounded edges follow the registered muscle-field borders
  (Z-Anatomy / BodyParts3D adaptation, CC BY-SA 4.0) with per-pair depths;
- authored sub-borders split deltoid heads, triceps long/lateral heads and the
  triceps tendon plate, and the gastrocnemius heads;
- patella, patellar tendon, tibial tuberosity, olecranon, epicondyles and
  malleoli are exact-height reliefs placed in CC0 MakeHuman joint frames.
Values are authored visual targets, not measured anatomy. Coordinates: dm.
"""
from pathlib import Path
import hashlib
import json
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/anatomy6"))
import relief as R  # noqa: E402
from scipy.sparse.csgraph import dijkstra  # noqa: E402

OUT = ROOT / "public/anatomy"
# Relief scale per sex and build: (grooves, landmarks).
SCALE = {
    ("male", "fit"): (1.0, 1.0),
    ("male", "average"): (0.35, 0.75),
    ("female", "fit"): (0.62, 0.85),
    ("female", "average"): (0.22, 0.6),
}


def sub_borders(p, labels, A, joints):
    extra = []
    z = np.array([0.0, 0.0, 1.0])
    for side, sign in (("L", 1), ("R", -1)):
        j = {k: np.array(v) for k, v in joints[side].items()}
        side_mask = p[:, 0] * sign > 0
        u = R._unit(j["elbow"] - j["shoulder"])
        ant = R._perp(z, u)
        lat = R._unit(np.cross(ant, u))
        lat = lat if lat[0] * sign > 0 else -lat
        rel = p - j["shoulder"]
        theta = np.degrees(np.arctan2(rel @ ant, rel @ lat))
        t = (rel @ u) / np.linalg.norm(j["elbow"] - j["shoulder"])
        deltoid = (labels == R.G["Deltoid"]) & side_mask
        extra += [(R.iso_seeds(theta, A, 38, deltoid), 1.1, 7), (R.iso_seeds(theta, A, -42, deltoid), 1.1, 7)]
        triceps = (labels == R.G["Triceps brachii"]) & side_mask
        extra.append((R.iso_seeds(theta, A, -62, triceps & (t < 0.66)), 1.3, 7))
        extra.append((R.iso_seeds(t, A, 0.64, triceps & (theta < -35) & (theta > -125)), 1.0, 8))
        k = R._unit(j["ankle"] - j["knee"])
        antk = R._perp(z, k)
        latk = R._unit(np.cross(antk, k))
        latk = latk if latk[0] * sign > 0 else -latk
        relk = p - j["knee"]
        thetak = np.degrees(np.arctan2(relk @ antk, relk @ latk))
        gastro = (labels == R.G["Gastrocnemius"]) & side_mask & ((relk @ k) < 1.6)
        extra.append((R.iso_seeds(thetak, A, -95, gastro), 1.4, 7))
    return extra


def rim_fade(n, parts, A):
    """0 on every open section rim (cuts stay planar), easing to 1 within 1.5 cm."""
    rim = np.zeros(n, bool)
    for part in parts:
        e = np.concatenate([part[:, [0, 1]], part[:, [1, 2]], part[:, [2, 0]]])
        e = np.sort(e, axis=1)
        uniq, count = np.unique(e, axis=0, return_counts=True)
        rim[uniq[count == 1].ravel()] = True
    d = dijkstra(A, directed=False, indices=np.flatnonzero(rim), min_only=True, limit=0.2)
    t = np.clip(np.nan_to_num(d, posinf=0.2) / 0.15, 0, 1)
    return t * t * (3 - 2 * t)


def relief_for(p, full, labels, A, joints, scale):
    groove_scale, landmark_scale = scale
    nrm = R.normals(p, full)
    g = R.smooth_field(R.groove_field2(p, labels, A, sub_borders(p, labels, A, joints)), A, 2) * groove_scale
    g = g + R.smooth_field(R.belly_field(labels, A), A, 3) * groove_scale
    q = p + nrm * g[:, None]
    lm = R.smooth_field(R.landmark_field(q, R.normals(q, full), joints, landmark_scale), A, 2)
    return nrm * (g + lm)[:, None]


report = []
for sex in ["male", "female"]:
    meta, raw, data, tris, infl = R.load(6, sex)
    n = len(data)
    idx = np.frombuffer(raw[n * 48:], "<u4").astype(np.int64)
    parts, o = [], 0
    for c in meta["partCounts"]:
        parts.append(idx[o:o + c].reshape(-1, 3))
        o += c
    full = np.concatenate(parts[:6])
    original = data.copy()
    average, fit = data[:, :3].copy(), data[:, :3] + data[:, 3:6]
    A = R.adjacency(fit, R.unique_tris(np.concatenate(parts)))
    labels = R.smoothed_labels(infl, A)
    fade = rim_fade(n, parts, A)[:, None]
    new_avg = average + relief_for(average, full, labels, A, meta["joints"], SCALE[(sex, "average")]) * fade
    new_fit = fit + relief_for(fit, full, labels, A, meta["joints"], SCALE[(sex, "fit")]) * fade
    data[:, :3] = new_avg
    data[:, 3:6] = new_fit - new_avg
    frozen = fade[:, 0] == 0
    data[frozen] = original[frozen]  # byte-identical rims, not merely within tolerance
    tri = idx.reshape(-1, 3)
    for t in [0, 0.25, 0.5, 0.75, 1]:
        a = (original[:, :3] + original[:, 3:6] * t)[tri]
        b = (data[:, :3] + data[:, 3:6] * t)[tri]
        an = np.cross(a[:, 1] - a[:, 0], a[:, 2] - a[:, 0])
        bn = np.cross(b[:, 1] - b[:, 0], b[:, 2] - b[:, 0])
        valid = np.linalg.norm(an, axis=1) > 1e-9
        assert (np.sum(an[valid] * bn[valid], axis=1) > 0).all(), (sex, t, "inverted face")
    blob = data.astype("<f4").tobytes() + raw[n * 48:]
    name = f"human-v7-{sex}"
    (OUT / f"{name}.bin").write_bytes(blob)
    meta.pop("occlusion", None)
    meta.update(
        version=7,
        buffer=name + ".bin",
        sha256=hashlib.sha256(blob).hexdigest(),
        parent=f"human-v6-{sex}",
        refinement=(
            "Muscle-field-registered separation grooves with rounded edges, authored deltoid/triceps/"
            "gastrocnemius sub-borders, and exact-height patella, patellar tendon, tibial tuberosity, "
            "olecranon, epicondyle and malleolus reliefs in CC0 joint frames. Exact revision 6 indices, "
            "rig sidecar, chart positions and categorical fields; section rims unchanged."
        ),
    )
    (OUT / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
    (OUT / f"muscle-field-v7-{sex}.bin").write_bytes((OUT / f"muscle-field-v6-{sex}.bin").read_bytes())
    fm = json.loads((OUT / f"muscle-field-v6-{sex}.json").read_text())
    fm.update(format=7, modifications=fm["modifications"] + " Revision 7 preserves the exact revision 6 categorical field and weights; its borders also place the surface separation grooves.")
    (OUT / f"muscle-field-v7-{sex}.json").write_text(json.dumps(fm, indent=2) + "\n")
    moved = max(np.linalg.norm(new_avg - average, axis=1).max(), np.linalg.norm(new_fit - fit, axis=1).max()) * 100
    rim = fade[:, 0] == 0
    report.append({
        "sex": sex, "vertices": n, "triangles": len(tri),
        "maxDisplacementMm": round(float(moved), 2),
        "rimVerticesUnchanged": bool(np.all(data[rim] == original[rim])),
        "topologyUnchanged": True, "invertedFaces": 0,
    })
manifest = json.loads((ROOT / "assets/anatomy/hashes.json").read_text())
for f in sorted(OUT.glob("*-v7-*")):
    manifest[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
(ROOT / "assets/anatomy/hashes.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(report, indent=2))
