"""Free-source body refinement: parent-constrained muscle heads and chest contour.

Requires bake-muscle-heads.py (Blender). Keeps every triangle, source ID, chart,
bone weight and section rim. Produces immutable r8 assets, never overwrites r7.
The Z-Anatomy-derived field and relief retain CC BY-SA 4.0 attribution.
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/anatomy6'))
import relief as R
OUT = ROOT / 'public/anatomy'
TEMP = ROOT / '.tools/anatomy/r8'
HEADS = json.loads((ROOT / 'src/muscle-heads.json').read_text())
COUNT = 37 + len(HEADS)
PARENT = np.array(list(range(37)) + [s['parent'] for s in HEADS])

def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)

def atlas(p, A, infl, sex):
    labels = np.load(TEMP / f'heads-{sex}.npz')['labels']
    original = np.zeros((len(p), 37), np.float32)
    for k in range(4):
        np.add.at(original, (np.arange(len(p)), infl[:, k]), infl[:, 4+k]/255)
    prob = np.zeros((len(p), COUNT), np.float32)
    prob[:, :37] = original
    B = (A > 0).astype(np.float32)
    for parent in sorted(set(s['parent'] for s in HEADS)):
        ids = [s['id'] for s in HEADS if s['parent'] == parent]
        seeds = np.flatnonzero(np.isin(labels, ids))
        eligible = np.flatnonzero(original[:, parent] > 0)
        nearest = cKDTree(p[seeds]).query(p[eligible])[1]
        q = np.zeros((len(p), len(ids)), np.float32)
        for j, id in enumerate(ids):
            q[eligible, j] = labels[seeds[nearest]] == id
        # Diffuse categorical weights only inside this parent's support.
        mask = original[:, parent] > 0
        deg = np.maximum(np.asarray(B @ mask.astype(np.float32)).ravel(), 1)
        for _ in range(8):
            q = (.55*q + .45*(B @ q)/deg[:, None])*mask[:, None]
        q /= np.maximum(q.sum(axis=1, keepdims=True), 1e-9)
        prob[:, ids] = q*original[:, parent, None]
        prob[:, parent] = 0
    prob[prob.sum(axis=1) < 1e-9, 36] = 1
    idx = np.argsort(-prob, axis=1, kind='stable')[:, :4]
    w = np.take_along_axis(prob, idx, axis=1)
    w = w/np.maximum(w.sum(axis=1, keepdims=True), 1e-9)*255
    rounded = np.floor(w).astype(np.uint8)
    # Exact total 255; avoids brightness and classification drift at boundaries.
    for k in range(4):
        missing = rounded.sum(axis=1) < 255
        best = (w-rounded).argmax(axis=1)
        rounded[np.flatnonzero(missing), best[missing]] += 1
    assert np.all(rounded.sum(axis=1) == 255)
    return idx.astype(np.uint8), rounded, prob.argmax(axis=1)

def rim_fade(n, parts, A):
    rim = np.zeros(n, bool)
    for part in parts:
        edges = np.sort(np.concatenate([part[:, [0, 1]], part[:, [1, 2]], part[:, [2, 0]]]), axis=1)
        e, count = np.unique(edges, axis=0, return_counts=True)
        rim[e[count == 1].ravel()] = True
    dist = dijkstra(A, directed=False, indices=np.flatnonzero(rim), min_only=True, limit=.2)
    return smooth(0, .16, np.nan_to_num(dist, posinf=.2))

# Historical r7 authored borders, used only to remove their relief.
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
        theta = np.degrees(np.arctan2(np.einsum("ij,j->i", rel, ant), np.einsum("ij,j->i", rel, lat)))
        t = (np.einsum("ij,j->i", rel, u)) / np.linalg.norm(j["elbow"] - j["shoulder"])
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
        thetak = np.degrees(np.arctan2(np.einsum("ij,j->i", relk, antk), np.einsum("ij,j->i", relk, latk)))
        gastro = (labels == R.G["Gastrocnemius"]) & side_mask & ((np.einsum("ij,j->i", relk, k)) < 1.6)
        extra.append((R.iso_seeds(thetak, A, -95, gastro), 1.4, 7))
    return extra


def chest(p, channels, sex, fit):
    if sex != 'male' or fit == 0:
        return p.copy()
    x, y, z = p.T
    ax = abs(x)
    arm = np.maximum(channels[:, 0], channels[:, 3])
    gate = (1-smooth(.03, .34, arm))*smooth(.35, .78, z)
    gate *= smooth(.06, .30, ax)*(1-smooth(1.38, 1.84, ax))
    gate *= smooth(4.0, 4.35, y)*(1-smooth(5.65, 5.98, y))
    # A replacement height field, not an extra bump on the old shelf. Broad,
    # monotone lower transition; the widest part lies above the nipple.
    h = y - .10*((ax-.88)/.95)**2
    levels = [3.9,4.1,4.3,4.45,4.6,4.8,5.0,5.2,5.4,5.6,5.8,6.0]
    profile = [1.01,1.10,1.22,1.35,1.46,1.52,1.53,1.50,1.40,1.23,1.06,.82]
    central = np.nan_to_num(PchipInterpolator(levels, profile, extrapolate=False)(h))
    lateral = PchipInterpolator([0,.2,.5,.8,1,1.25,1.5,1.85,3],[-.02,.025,.065,.05,0,-.14,-.35,-.65,-1],extrapolate=True)(ax)
    target = central+lateral
    # Preserve tiny nipple relief from the existing mesh, while discarding
    # the large surrounding depression. This is an original visual contour.
    nipple = np.exp(-((ax-.966)/.10)**2-((y-4.653)/.085)**2)
    target += .024*nipple
    q = p.copy()
    q[:, 2] += (target-z)*gate
    return q

reports = []
for sex in ['male', 'female']:
    meta, raw, original, tris, infl = R.load(7, sex)
    n = len(original)
    idx = np.frombuffer(raw[n*48:], '<u4')
    parts, off = [], 0
    for c in meta['partCounts']:
        parts.append(idx[off:off+c].reshape(-1, 3)); off += c
    full = np.concatenate(parts[:6])
    fit = original[:, :3]+original[:, 3:6]
    A = R.adjacency(fit, R.unique_tris(tris))
    ids, weights, labels = atlas(fit, A, infl, sex)
    fade = rim_fade(n, parts, A)
    coo = A.tocoo()
    # Head boundaries are anatomical source projections, replacing the old
    # angle guesses. Do not cut deep channels between parts of one muscle.
    edge = (labels[coo.row] != labels[coo.col]) & (PARENT[labels[coo.row]] == PARENT[labels[coo.col]]) & (labels[coo.row] >= 37)
    seeds = np.unique(coo.row[edge])
    distance = dijkstra(A, directed=False, indices=seeds, min_only=True, limit=.35)
    head_relief = R.smooth_field(R.lipped_groove(distance, .008, .075), A, 3)
    # Remove r7's analytic head grooves before applying the source-derived ones.
    # Recompute its displacement on r6 with and without the authored borders.
    _, _, d6, _, _ = R.load(6, sex)
    shapes = []
    parent_labels = R.smoothed_labels(infl, A)
    for build in [0, 1]:
        p = original[:, :3]+original[:, 3:6]*build
        base = d6[:, :3]+d6[:, 3:6]*build
        scale = ([.35, 1.0] if sex == 'male' else [.22, .62])[build]
        old = R.groove_field2(base, parent_labels, A, sub_borders(base, parent_labels, A, meta['joints']))
        plain = R.groove_field2(base, parent_labels, A)
        change = R.smooth_field(plain-old, A, 2)*scale + head_relief*scale
        q = p + R.normals(base, full)*change[:, None]*fade[:, None]
        shaped = chest(q, original[:, 6:], sex, build)
        q = q+(shaped-q)*fade[:, None]
        q[fade == 0] = p[fade == 0]
        shapes.append(q)
    data = original.copy()
    data[:, :3] = shapes[0]
    data[:, 3:6] = shapes[1]-shapes[0]
    data[fade == 0] = original[fade == 0]
    assert np.isfinite(data).all(), "non-finite vertex"
    for morph in [0, .25, .5, .75, 1]:
        a = (original[:, :3]+original[:, 3:6]*morph)[tris]
        b = (data[:, :3]+data[:, 3:6]*morph)[tris]
        na = np.cross(a[:, 1]-a[:, 0], a[:, 2]-a[:, 0])
        nb = np.cross(b[:, 1]-b[:, 0], b[:, 2]-b[:, 0])
        valid = np.linalg.norm(na, axis=1) > 1e-9
        assert (np.sum(na[valid]*nb[valid], axis=1) > 0).all(), (sex, morph, 'inverted face')
    blob = data.astype('<f4').tobytes()+raw[n*48:]
    name = f'human-v8-{sex}'
    (OUT / (name+'.bin')).write_bytes(blob)
    meta.pop('occlusion', None)
    meta['surfaceLicense'] = 'CC-BY-SA-4.0'
    meta['attribution'] = 'MakeHuman CC0 base; Z-Anatomy / BodyParts3D CC BY-SA 4.0 muscle-derived relief. See assets/anatomy/atlas/source.json.'
    meta.update(version=8, buffer=name+'.bin', parent=f'human-v7-{sex}', sha256=hashlib.sha256(blob).hexdigest(), refinement='Source-projected muscle heads replace analytic head divisions; continuous inferior male pectoral contour. Exact r7 topology, rig weights, charts, section rims and joint correctives retained. Visual approximation.')
    (OUT / (name+'.json')).write_text(json.dumps(meta, indent=2)+'\n')
    old_field = (OUT / f'muscle-field-v7-{sex}.bin').read_bytes()
    colors = np.frombuffer(old_field[:n*3], np.uint8).reshape(n, 3).copy()
    for s in HEADS:
        colors[labels == s['id']] = [int(s['color'][i:i+2], 16) for i in [1, 3, 5]]
    field = colors.tobytes()+labels.astype(np.uint8).tobytes()+np.concatenate([ids, weights], axis=1).tobytes()
    (OUT / f'muscle-field-v8-{sex}.bin').write_bytes(field)
    fm = json.loads((OUT / f'muscle-field-v7-{sex}.json').read_text())
    fm.update(format=8, sha256=hashlib.sha256(field).hexdigest(), headGroups=HEADS, modifications='Existing 36-group parent registration constrained projection of 56 individual Z-Anatomy muscle meshes, with categorical smoothing and normalized weights. Source-derived head borders replace angle-based guesses. Not validated anatomy or non-rigid ICP.')
    (OUT / f'muscle-field-v8-{sex}.json').write_text(json.dumps(fm, indent=2)+'\n')
    reports.append({'sex': sex, 'vertices': n, 'triangles': len(tris), 'headLabels': len(set(labels)-set(range(37))), 'visibleRegions': len(set(labels)-{36}), 'maxDisplacementMm': float(max(np.linalg.norm(shapes[b]-original[:, :3]-original[:, 3:6]*b, axis=1).max() for b in [0, 1])*100), 'rimsExact': bool(np.all(data[fade == 0] == original[fade == 0])), 'invertedFaces': 0})
manifest = json.loads((ROOT / 'assets/anatomy/hashes.json').read_text())
for f in OUT.glob('*-v8-*'):
    manifest[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
(ROOT / 'assets/anatomy/hashes.json').write_text(json.dumps(manifest, indent=2)+'\n')
(ROOT / 'qa/body-017/geometry-build.json').write_text(json.dumps(reports, indent=2)+'\n')
print(json.dumps(reports, indent=2))
