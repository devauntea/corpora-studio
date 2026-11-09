"""Blender batch: project individual source muscle heads inside their parent field.

Run with --background --factory-startup --disable-autoexec --python this_file.
Only loads mesh data from the pinned Z-Anatomy blend; no embedded script runs.
Output remains a CC BY-SA 4.0 adaptation, not an anatomically validated atlas.
The existing parent field is a constraint: a deltoid head cannot paint the chest.
"""
from pathlib import Path
import hashlib
import json
import bpy
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / ".tools/anatomy/r8"
TEMP.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / ".tools/anatomy/z-anatomy/Z-Anatomy/Startup.blend"
spec = json.loads((ROOT / "src/muscle-heads.json").read_text())
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False, use_scripts=False)

def canonical(p):
    return Vector((p.x, p.z, -p.y))

def capsule(name):
    obj = bpy.data.objects['Articular capsule of ' + name + ' joint.l']
    return canonical(sum((obj.matrix_world @ Vector(c) for c in obj.bound_box), Vector()) / 8)

sh, el, wr, hip, knee = [capsule(n) for n in ['glenohumeral', 'elbow', 'radiocarpal', 'hip', 'knee']]
ankle = Vector((.075, .08, -.02))

def frame(a, b):
    axis = (b-a).normalized()
    front = Vector((0, 0, 1))
    front = (front-axis*axis.dot(front)).normalized()
    return Matrix((axis.cross(front).normalized(), axis, front)).transposed()

def segment(p, a, b, c, d, width):
    v = frame(a, b).transposed() @ (p-a)
    v.x *= width
    v.z *= width
    v.y *= (d-c).length / (b-a).length
    return c + frame(c, d) @ v

source = []
for obj in bpy.data.objects:
    cols = [c.name for c in obj.users_collection]
    if obj.type != 'MESH' or 'Muscles' not in cols:
        continue
    head = next((s for s in spec if s['match'] in obj.name.lower()), None)
    if head is None:
        continue
    obj.data.calc_loop_triangles()
    source.append((obj.name, head, 'arm' if any(c in cols for c in ['Left upper limb', 'Right upper limb']) else 'leg' if any(c in cols for c in ['Left lower limb', 'Right lower limb']) else 'trunk',
                   [canonical(obj.matrix_world @ v.co) for v in obj.data.vertices],
                   [tuple(t.vertices) for t in obj.data.loop_triangles]))
assert set(s['id'] for _, s, *_ in source) == set(s['id'] for s in spec)

reports = []
for sex in ['male', 'female']:
    meta = json.loads((ROOT / f'public/anatomy/human-v7-{sex}.json').read_text())
    n = meta['vertexCount']
    values = np.fromfile(ROOT / 'public/anatomy' / meta['buffer'], '<f4', count=n*12).reshape(n, 12)
    field = np.fromfile(ROOT / f'public/anatomy/muscle-field-v7-{sex}.bin', np.uint8)
    influences = field[n*4:].reshape(n, 8)
    parent = influences[np.arange(n), np.argmax(influences[:, 4:], axis=1)]
    joints = {k: Vector(v) for k, v in meta['joints']['L'].items()}
    def register(point, region):
        sign = 1 if point.x >= 0 else -1
        p = Vector((abs(point.x), point.y, point.z))
        if region == 'arm':
            upper = segment(p, sh, el, joints['shoulder'], joints['elbow'], 10.6)
            lower = segment(p, el, wr, joints['elbow'], joints['wrist'], 9.5)
            t = max(0, min(1, (el.y+.045-p.y)/.09))
            q = upper.lerp(lower, t*t*(3-2*t))
        elif region == 'leg':
            upper = segment(p, hip, knee, joints['hip'], joints['knee'], 11.3)
            lower = segment(p, knee, ankle, joints['knee'], joints['ankle'], 10.4)
            t = max(0, min(1, (knee.y+.045-p.y)/.09))
            q = upper.lerp(lower, t*t*(3-2*t))
        else:
            q = Vector((p.x*10.5*(joints['shoulder'].x/1.88175), (p.y-hip.y)*(joints['shoulder'].y-joints['hip'].y)/(sh.y-hip.y)+joints['hip'].y, p.z*10.5+.15))
        q.x *= sign
        return q
    trees = {}
    for group in sorted(set(s['parent'] for s in spec)):
        verts, faces, ids = [], [], []
        for name, head, region, vs, fs in source:
            if head['parent'] != group:
                continue
            off = len(verts)
            verts.extend(register(p, region) for p in vs)
            faces.extend(tuple(i+off for i in f) for f in fs)
            ids.extend([head['id']] * len(fs))
        trees[group] = BVHTree.FromPolygons(verts, faces, all_triangles=True), ids
    labels = parent.copy()
    distances = np.zeros(n, dtype=np.float32)
    for i in np.flatnonzero(np.isin(parent, list(trees))):
        p = Vector(values[i, :3] + values[i, 3:6]*.6)
        js = {k: Vector(q) for k, q in meta['joints']['L' if p.x >= 0 else 'R'].items()}
        group = int(parent[i])
        if group in [8, 9, 10, 19]:
            a, b = js['shoulder'], js['elbow'] if group != 19 else js['wrist']
        elif group in [26, 28, 29, 32]:
            a, b = (js['knee'], js['ankle']) if group in [29, 32] else (js['hip'], js['knee'])
        else:
            a, b = Vector((0, -10, .15)), Vector((0, 10, .15))
        axis = (b-a).normalized()
        off = p-a
        radial = (off-axis*axis.dot(off)).normalized()
        tree, ids = trees[group]
        hit, normal, idx, distance = tree.ray_cast(p+radial*2.5, -radial, 5)
        if idx is None:
            hit, normal, idx, distance = tree.find_nearest(p)
        if idx is not None:
            labels[i] = ids[idx]
            distances[i] = (hit-p).length
    np.savez_compressed(TEMP / f'heads-{sex}.npz', labels=labels, parent=parent, distances=distances)
    report = {'sex': sex, 'vertices': n, 'headVertexCounts': {s['name']: int(np.sum(labels == s['id'])) for s in spec}, 'sourceToSkinDistanceDmP95': float(np.percentile(distances[distances > 0], 95))}
    reports.append(report)
    print(json.dumps(report), flush=True)
(TEMP / 'registration.json').write_text(json.dumps({'method': 'Inherited segment landmark registration, parent-constrained outward ray projection with nearest-surface fallback; no non-rigid ICP or accuracy claim.', 'license': 'CC-BY-SA-4.0', 'blendSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'sourceObjects': [name for name, *_ in source], 'bodies': reports}, indent=2)+'\n')
(ROOT / 'assets/anatomy/atlas/registration-v8.json').write_bytes((TEMP / 'registration.json').read_bytes())
