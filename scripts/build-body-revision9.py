"""Build immutable r9 muscle-volume studies from r8 using free local tools.

Blender fairs existing narrow surface irregularities before broad, atlas-guided
belly volumes are added. This is a conservative artistic refinement, not a
scan, new anatomical registration, or a muscle simulation. No triangle/vertex
identity, cut rim, chart, rig weight, or joint corrective is changed.

Run with host Python (NumPy/SciPy) and Blender 4.5:
  python3 scripts/build-body-revision9.py
  BODY_REVISION=9 node scripts/bake-body-occlusion.mjs
  /Volumes/Blender/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python scripts/blender-body-r9.py -- render
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from scipy.sparse.csgraph import dijkstra

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/anatomy6'))
import relief as R

OUT = ROOT / 'public/anatomy'
TEMP = ROOT / '.tools/anatomy/r9'
QA = ROOT / 'qa/body-018'
BLENDER = os.environ.get('BLENDER', '/Volumes/Blender/Blender.app/Contents/MacOS/Blender')
HEADS = json.loads((ROOT / 'src/muscle-heads.json').read_text())
PARENTS = np.array(list(range(37)) + [s['parent'] for s in HEADS])


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def span(x, start, rise, fall, end):
    return smooth(start, rise, x)*(1-smooth(fall, end, x))


def prepare(sex):
    meta, raw, original, tris, infl = R.load(8, sex)
    n = len(original)
    parts, off = [], 0
    for count in meta['partCounts']:
        parts.append(tris[off:off+count//3]); off += count//3
    unique = R.unique_tris(tris)
    fit = original[:, :3] + original[:, 3:6]
    A = R.adjacency(fit, unique)
    # A separate library section may introduce a rim through an otherwise
    # continuous surface. All of them are locked, not just full-body boundaries.
    rim = np.zeros(n, bool)
    for part in parts:
        e = np.sort(np.concatenate([part[:, [0,1]], part[:, [1,2]], part[:, [2,0]]]), axis=1)
        e, counts = np.unique(e, axis=0, return_counts=True)
        rim[e[counts == 1].ravel()] = True
    dist = dijkstra(A, directed=False, indices=np.flatnonzero(rim), min_only=True, limit=.65)
    # A wide falloff is essential: a narrow fade around a fixed shared rim
    # produces a visible ring when its neighbouring muscle volume increases.
    fade = smooth(0, .60, np.nan_to_num(dist, posinf=.65))

    # Diffuse registered probabilities on topology. This avoids imprinting
    # categorical atlas edges as sharp grooves or separate blobs in the skin.
    probabilities = np.zeros((n, len(PARENTS)), np.float64)
    for k in range(4):
        np.add.at(probabilities, (np.arange(n), infl[:, k]), infl[:, k+4]/255)
    B = (A > 0).astype(np.float64)
    deg = np.maximum(np.asarray(B.sum(axis=1)).ravel(), 1)
    for _ in range(24):
        probabilities = .5*probabilities + .5*(B @ probabilities)/deg[:, None]
    parents = np.zeros((n, 37), np.float64)
    for k, parent in enumerate(PARENTS):
        parents[:, parent] += probabilities[:, k]

    def field(ids):
        return probabilities[:, ids].sum(axis=1)

    x, y, z = fit.T
    dorsal = 1-smooth(-.10, .15, z)
    # Protect the entire anterior trunk, including the deliberately rebuilt
    # male pectoral contour and the female breast/chest structure.
    trunk = 1-smooth(.02, .25, np.maximum(original[:, 6], original[:, 9]))
    chest_protect = trunk*smooth(.15, .4, z)*span(y, 3.8, 4.0, 6.15, 6.4)
    offsets = np.zeros(n)
    active = np.zeros(n)
    def add(weight, mm):
        nonlocal offsets, active
        offsets += weight*mm/100
        active = np.maximum(active, weight)

    # Continuous back planes: no diagonal X grooves, rows of bumps, or raised
    # muscle striations. The registered parent field gates these broad forms.
    back = dorsal*trunk*span(y, 1.7, 2.25, 6.25, 6.8)
    add(parents[:, 5]*back*span(y, 1.8, 2.8, 4.4, 5.4), 8.0)
    add(parents[:, 6]*back, 5.5)
    add(parents[:, 7]*back, 4.5)
    add(parents[:, 4]*back*span(abs(x), .10, .40, 1.05, 1.85), 4.5)
    add(parents[:, 35]*back, 3.0)

    for side, sign in [('L', 1), ('R', -1)]:
        joints = {key: np.asarray(value) for key, value in meta['joints'][side].items()}
        side_mask = smooth(-.03, .03, x*sign)
        def along(start, end):
            axis = joints[end]-joints[start]
            length_squared = float(np.sum(axis*axis))
            assert length_squared > 1e-8
            return np.einsum('ij,j->i',fit-joints[start],axis)/length_squared
        upper = along('shoulder', 'elbow')
        lower = along('elbow', 'wrist')
        thigh = along('hip', 'knee')
        calf = along('knee', 'ankle')
        # The belly tapers before joints and insertions. Both biceps heads and
        # the triceps long/lateral heads remain one continuous skin surface.
        add(field([37,38,39])*side_mask*span(upper, -.32, -.03, .28, .66), 5.0)
        add(field([40,41])*side_mask*span(upper, .05, .31, .65, .94), 10.0)
        add(field([42,43,44])*side_mask*span(upper, .02, .27, .68, .94), 9.0)
        add(parents[:,11]*side_mask*span(upper, .17, .48, .77, .97), 4.0)
        add(parents[:,12]*side_mask*span(lower, -.04, .14, .43, .80), 5.0)
        add(field([63,64])*side_mask*span(lower, .02, .18, .48, .83), 3.0)
        add(parents[:,22]*side_mask*span(thigh, .00, .24, .62, .91), 6.5)
        add(parents[:,23]*side_mask*span(thigh, .02, .25, .69, .95), 10.0)
        add(parents[:,24]*side_mask*span(thigh, .22, .52, .84, 1.0), 9.0)
        add(field([48,49,50,51])*side_mask*span(thigh, .05, .23, .66, .91), 7.0)
        add(field([52])*side_mask*span(calf, -.02, .16, .38, .68), 8.5)
        add(field([53])*side_mask*span(calf, -.02, .12, .33, .60), 7.0)
        add(parents[:,30]*side_mask*span(calf, .16, .35, .59, .85), 3.0)
        add(parents[:,31]*side_mask*span(calf, .04, .19, .64, .91), 2.2)

    offsets = R.smooth_field(offsets, A, 64)*fade*(1-chest_protect)
    active = R.smooth_field(active, A, 12)*fade*(1-chest_protect)
    # Bound fairing to muscle skin, leaving feet, hands, bony landmarks and
    # anterior trunk intact. Blender's result is additionally capped at 2 mm.
    fair = np.clip(active*1.7, 0, 1)
    np.savez(TEMP/f'input-{sex}.npz', original=original, tris=unique,
             fair=fair, rim=rim, offsets=offsets, fade=fade)
    return meta, raw, original, tris, rim, fade, offsets, A


def validate(original, data, tris, rim):
    # Validate the actual serialized float32 data, not only double precision.
    d = data.astype('<f4').astype(np.float64)
    assert np.isfinite(d).all(), 'Non-finite vertex data'
    assert np.array_equal(d[:,6:], original[:,6:]), 'Rig channels changed'
    assert np.array_equal(d[rim], original[rim]), 'Section rim changed'
    result = []
    for morph in [0, .125, .25, .375, .5, .625, .75, .875, 1]:
        a = (original[:,:3]+original[:,3:6]*morph)[tris]
        b = (d[:,:3]+d[:,3:6]*morph)[tris]
        na = np.cross(a[:,1]-a[:,0], a[:,2]-a[:,0])
        nb = np.cross(b[:,1]-b[:,0], b[:,2]-b[:,0])
        lena, lenb = np.linalg.norm(na,axis=1), np.linalg.norm(nb,axis=1)
        valid = lena > 1e-9
        dots = np.sum(na[valid]*nb[valid],axis=1)
        assert np.all(dots > 0), ('Reversed triangle', morph, int(np.count_nonzero(dots <= 0)))
        assert np.all(lenb[valid] > 1e-10), ('Collapsed triangle', morph)
        result.append({'build': morph, 'reversedFaces': 0,
                       'minAreaRatio': float((lenb[valid]/lena[valid]).min())})
    return d, result


def main():
    TEMP.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    inputs = {sex: prepare(sex) for sex in ['male', 'female']}
    subprocess.run([BLENDER, '--background', '--factory-startup', '--disable-autoexec',
                    '--python', str(ROOT/'scripts/blender-body-r9.py'), '--', 'fair'], check=True)
    reports = []
    for sex, prepared in inputs.items():
        meta, raw, original, tris, rim, fade, offsets, A = prepared
        n = len(original)
        faired = np.load(TEMP/f'faired-{sex}.npz')
        shapes = []
        scales = [.22, 1.0] if sex == 'male' else [.14, .58]
        for build in [0,1]:
            p = original[:,:3]+original[:,3:6]*build
            # Smooth the normal frame rather than amplifying narrow existing
            # surface ridges while enlarging a muscle belly.
            normal = R.normals(p, R.unique_tris(tris))
            for axis in range(3):
                normal[:,axis] = R.smooth_field(normal[:,axis], A, 12)
            normal /= np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-9)
            fair_delta = faired[f'build{build}']-p
            length = np.linalg.norm(fair_delta,axis=1)
            fair_delta *= np.minimum(1, .020/np.maximum(length,1e-12))[:,None]
            # Average bodies keep soft planes; fit bodies receive the stronger
            # relief, with the same continuous correspondence between builds.
            q = p+fair_delta*([.5,1.0][build])+normal*(offsets*scales[build])[:,None]
            q[fade == 0] = p[fade == 0]
            shapes.append(q)
        data = original.copy()
        data[:,:3] = shapes[0]
        data[:,3:6] = shapes[1]-shapes[0]
        data[fade == 0] = original[fade == 0]
        data, checks = validate(original, data, tris, rim)
        blob = data.astype('<f4').tobytes()+raw[n*48:]
        assert blob[n*48:] == raw[n*48:]
        name = f'human-v9-{sex}'
        (OUT/(name+'.bin')).write_bytes(blob)
        meta.pop('occlusion', None)
        meta['inheritedChestPolish'] = meta.pop('polish', None)
        meta.update(version=9, buffer=name+'.bin', parent=f'human-v8-{sex}',
                    sha256=hashlib.sha256(blob).hexdigest(),
                    refinement='Blender-faired arm/back/leg muscle surfaces and broad atlas-guided belly volumes, scaled by body build. Existing chest retained. Exact r8 topology, rig channels, charts and every section rim retained. Artistic approximation, not validated anatomy or simulated flexion.')
        meta['polish'] = {'tool': 'Blender 4.5.9 LTS', 'method': 'Weighted 18-iteration surface fairing capped at 2 mm; smooth low-frequency muscle volume, no new grooves.'}
        (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
        field = (OUT/f'muscle-field-v8-{sex}.bin').read_bytes()
        (OUT/f'muscle-field-v9-{sex}.bin').write_bytes(field)
        fm = json.loads((OUT/f'muscle-field-v8-{sex}.json').read_text())
        fm.update(format=9, sha256=hashlib.sha256(field).hexdigest())
        fm['surfaceRevision'] = 9
        fm['registrationNote'] = 'Identical r8 52-region registration and source attribution; r9 changes only muscle-surface shape.'
        (OUT/f'muscle-field-v9-{sex}.json').write_text(json.dumps(fm,indent=2)+'\n')
        changes = []
        for b in [0,1]:
            delta = np.linalg.norm((data[:,:3]+data[:,3:6]*b)-(original[:,:3]+original[:,3:6]*b),axis=1)*100
            changes.append({'build': b, 'maxDisplacementMm': float(delta.max()),
                            'p95DisplacementMm': float(np.percentile(delta,95)),
                            'changedVerticesOver0_1mm': int(np.count_nonzero(delta>.1))})
        reports.append({'sex': sex, 'vertices': n, 'triangles': len(tris),
                        'lockedRimVertices': int(rim.sum()), 'rimsExact': True,
                        'indicesExact': True, 'rigChannelsExact': True,
                        'muscleFieldExact': True, 'changes': changes, 'morphChecks': checks})
    (QA/'revision9-geometry.json').write_text(json.dumps(reports,indent=2)+'\n')
    # Refresh only the new revision; r8 is immutable and remains loadable.
    path = ROOT/'assets/anatomy/hashes.json'
    hashes = json.loads(path.read_text())
    for f in OUT.glob('*-v9-*'):
        hashes[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
    path.write_text(json.dumps(hashes,indent=2)+'\n')
    print(json.dumps(reports,indent=2))


if __name__ == '__main__':
    main()
