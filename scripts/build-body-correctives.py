"""Centres of rotation for revision 7 elbows and knees (bend correctives).

Writes public/anatomy/cor-v7-{sex}.bin + .json and links it from
human-v7-{sex}.json. Layout (little endian):
  uint32 count | uint32 vertex[count] | float32 average[count*3] |
  float32 fit[count*3] | float32 alpha[count]
The app rotates these elbow/knee transition vertices about their centre
(Le & Hodgins 2016, ring-centroid approximation) and keeps normalized DQS
everywhere else. This removes the joint "pillow" bulge of dual quaternions
without the volume collapse of linear blending. Visual approximation only.
"""
from pathlib import Path
import hashlib
import json
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/anatomy6"))
import relief as R  # noqa: E402
import rig7  # noqa: E402

OUT = ROOT / "public/anatomy"
report = []
for sex in ["male", "female"]:
    meta, raw, data, tris, infl = R.load(7, sex)
    n = len(data)
    bones, offsets, indices, weights = rig7.load_rig(sex, n)
    avg = data[:, :3]
    fit = data[:, :3] + data[:, 3:6]
    fi, fc, fa = rig7.centers_of_rotation(fit, bones, offsets, indices, weights)
    ai, ac, aa = rig7.centers_of_rotation(avg, bones, offsets, indices, weights)
    order = np.argsort(fi)
    fi, fc, fa = fi[order], fc[order], fa[order]
    lookup = {int(v): k for k, v in enumerate(ai)}
    avg_c = np.array([ac[lookup[v]] if v in lookup else fc[k] for k, v in enumerate(fi)])
    alpha = np.array([min(fa[k], aa[lookup[v]]) if v in lookup else fa[k] for k, v in enumerate(fi)])
    blob = (
        np.array([len(fi)], "<u4").tobytes()
        + fi.astype("<u4").tobytes()
        + avg_c.astype("<f4").tobytes()
        + fc.astype("<f4").tobytes()
        + alpha.astype("<f4").tobytes()
    )
    name = f"cor-v7-{sex}"
    (OUT / f"{name}.bin").write_bytes(blob)
    digest = hashlib.sha256(blob).hexdigest()
    (OUT / f"{name}.json").write_text(json.dumps({
        "version": 1,
        "buffer": f"{name}.bin",
        "sha256": digest,
        "count": int(len(fi)),
        "method": "Centres of rotation for elbow/knee transition vertices: centroid of the skin ring with matching child-chain weight (approximation of Le & Hodgins 2016), smoothed along the weight axis, feathered to DQS at weight extremes.",
        "license": "Derived from CC0 MakeHuman skeleton weights and revision 7 geometry.",
    }, indent=2) + "\n")
    meta["centersOfRotation"] = {"buffer": f"{name}.bin", "sha256": digest, "count": int(len(fi))}
    (OUT / f"human-v7-{sex}.json").write_text(json.dumps(meta, indent=2) + "\n")
    report.append({"sex": sex, "vertices": int(len(fi)), "bytes": len(blob)})
manifest = json.loads((ROOT / "assets/anatomy/hashes.json").read_text())
for f in sorted(OUT.glob("*-v7-*")):
    manifest[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
(ROOT / "assets/anatomy/hashes.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(report))
