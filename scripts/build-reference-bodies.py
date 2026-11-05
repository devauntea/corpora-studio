"""Revision 5: reference-led body proportions and continuous anatomical planes.

Build-time NumPy only. The pinned CC0 MakeHuman-derived revision 4 is immutable.
Topology, rig weights and registered muscle identities are retained, so the
atlas follows each new sculpt without a second, independently fitted surface.
Coordinates are decimeters. Reference photographs are not packaged as textures.
"""
import hashlib
import json
from collections import defaultdict
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'


def bell(x, radius):
    return np.exp(-np.minimum(80, (x / radius) ** 2))


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def sculpt(p, weights, joints, sex, fit):
    x, y, z = p.T
    ax, sign = abs(x), np.sign(x)
    front, back = smooth(.25, .85, z), 1 - smooth(-.65, -.15, z)
    arm = np.maximum(weights[:, 0], weights[:, 3])
    trunk = (1 - smooth(.06, .45, arm)) * smooth(.6, 1.35, y)
    q = p.copy()
    female = sex == 'female'

    # Remove the old rectangular abdominal pads, replacing them with connected,
    # tapering rectus columns and shallow irregular tendinous intersections.
    if fit:
        old_strength = .62 if female else 1
        dz = np.zeros(len(p))
        for cy, ry, amp in [(4.05, .30, .065), (3.42, .29, .085),
                            (2.80, .28, .075), (2.13, .40, .045)]:
            old = np.exp(-np.minimum(80, ((ax-.40)/.35)**4 + ((y-cy)/ry)**4))
            dz -= old_strength * amp * old
        strength = .30 if female else 1
        width = .35 - .045 * smooth(2.7, 4.5, y)
        column = bell(ax-(.38+.03*np.sin(y*2)), width) * bell(y-3.32, 1.22)
        dz += .061 * strength * column
        for cy in [2.45, 3.10, 3.74]:
            # Reverse the previous deep cut, then form a broader softer join.
            dz += .014 * (.45 if female else 1) * bell(y-cy-.025*np.sin(ax*4), .08) * bell(ax-.4, .44)
            dz -= .017 * strength * bell(y-cy-.06*ax-.018*sign, .075) * bell(ax-.42, .37)
        dz += .010 * old_strength * bell(x, .065) * bell(y-3.3, 1.3)
        if not female:
            # Pectorals form a sloping fan across the rib cage, not domed discs.
            dz += .030 * bell(ax-.93, .72) * bell(y-5.15, .50)
            dz -= .019 * bell(y-(4.47+.11*ax), .12) * bell(ax-.93, .65)
            dz -= .014 * bell(ax-1.61, .12) * bell(y-5.20, .44)
        q[:, 2] += dz * front * trunk
        # Small oblique taper and broad lat volume rather than a pinched waist.
        q[:, 0] -= sign * (.028 if female else .037) * bell(y-2.9, .8) * bell(ax-1.4, .45) * trunk
        q[:, 2] -= .028 * bell(ax-.78, .58) * bell(y-4.1, 1.0) * back * trunk
    else:
        # Reference Average has genuine soft-tissue volume over the same joints.
        q[:, 0] += sign * (.075 if female else .065) * bell(y-2.25, 1.28) * bell(ax-1.42, .65) * trunk
        q[:, 2] += (.105 if female else .145) * bell(x, 1.04) * bell(y-2.52, 1.05) * front * trunk
        q[:, 2] -= .040 * bell(ax-.75, .7) * bell(y-1.75, 1.0) * back * trunk
        q[:, 2] += .022 * bell(y-2.0, .14) * bell(ax-1.30, .45) * front * trunk

    # A soft iliac transition and a defined (not sharpened) navel depression.
    q[:, 2] -= (.012 if female else .016) * bell(x, .095) * bell(y-2.36, .12) * front * trunk
    q[:, 0] += sign * (.045 if female else .018) * bell(y-.75, .70) * bell(ax-1.65, .45) * (1-arm)
    # Shoulder blades blend into the thorax; avoid parallel sculpted grooves.
    q[:, 2] += .013 * bell(ax-.6, .22) * bell(y-5.0, .65) * back * trunk
    # The prior sculpt made a straight raised bar across each shoulder blade.
    # Keep the landmark, but spread its relief into a broad curved scapular plane.
    muscle = (.45 if female else 1) * fit
    old_scap = 5.48-.37*ax
    q[:, 2] += .82*(.018+.040*muscle)*bell(y-old_scap, .075)*bell(ax-1, .64)*back*trunk
    q[:, 2] -= (.008+.012*muscle)*bell(y-(5.35-.25*ax-.09*ax*ax), .24)*bell(ax-1.05, .53)*back*trunk

    # Reference-led chest silhouette: a rounded inferior pectoral edge, with
    # volume above the infrapectoral fold rather than a flat diagonal shelf.
    if not female:
        lower=4.45+.20*((ax-.85)/.95)**2
        q[:, 2] += (.038+.090*fit)*bell(ax-.87,.67)*bell(y-4.91,.43)*front*trunk
        q[:, 2] -= (.010+.021*fit)*bell(y-lower,.105)*bell(ax-.86,.70)*front*trunk
        q[:, 2] += .025*fit*bell(ax-.95,.70)*bell(y-5.60,.38)*front*trunk
    else:
        # Define the upper rib cage and clavicular pectoral transition without
        # replacing breast volume with a male pectoral shape.
        q[:, 2] += (.010+.021*fit)*bell(ax-.80,.59)*bell(y-5.72,.34)*front*trunk
        q[:, 2] -= .010*fit*bell(ax-1.38,.17)*bell(y-4.48,.65)*front*trunk

    # Broad posterior volumes with narrower valleys between actual groups.
    # Stronger in Fit, softened but still present beneath Average soft tissue.
    strength=(.29+.71*fit)*(.63 if female else 1)
    relief=(.072*bell(ax-1.10,.47)*bell(y-3.98,1.13)
            +.045*bell(ax-(.38+.14*(5.8-y)),.34)*bell(y-5.35,.85)
            +.041*bell(ax-1.04,.34)*bell(y-5.12,.36)
            +.042*bell(ax-1.26,.33)*bell(y-4.62,.28)
            +.025*bell(ax-.30,.18)*bell(y-3.48,1.35))
    relief-=.014*bell(ax-(.63+.14*(5.5-y)),.10)*bell(y-4.95,.57)
    q[:, 2]-=strength*relief*back*trunk
    q[:, 0]+=sign*.038*strength*bell(ax-1.57,.25)*bell(y-4.03,.80)*back*trunk

    for side, k in [('L', 0), ('R', 3)]:
        j = joints[side]
        gate = weights[:, k]
        shoulder, elbow, wrist = [np.array(j[t]) for t in ['shoulder', 'elbow', 'wrist']]
        for a, b, upper in [(shoulder, elbow, True), (elbow, wrist, False)]:
            axis = b-a
            size = np.linalg.norm(axis)
            axis /= size
            t = np.sum((p-a)*axis, axis=1) / size
            off = p-a-t[:, None]*size*axis
            radius = np.linalg.norm(off, axis=1)
            s = 1 if side == 'L' else -1
            theta = np.arctan2(off[:, 0]*s, off[:, 2])
            if upper:
                # Deltoid cap / biceps / posterior triceps remain distinct volumes.
                d = (.018 if female else .026)*bell(t-.16, .17)
                d += (.012 if female else .020)*fit*bell(t-.61, .24)*bell(abs(theta)-2.25, .65)
                d -= .012*fit*bell(t-.38, .08)*np.maximum(0, np.sin(theta))**2
            else:
                # Brachiordialis sweeps into a thin wrist; preserve styloid landmarks.
                d = (.012+.010*fit)*bell(t-.25, .22)*bell(theta-.70, .5)
                d -= .009*bell(t-.86, .16)
            d *= smooth(-.1, .06, t)*(1-smooth(.90, 1.08, t))*gate
            q += off * (d/np.maximum(radius, .01))[:, None]

        # Foot arch, heel pad and two Achilles margins. No spikes at the toes.
        ankle = np.array(j['ankle'])
        dx, dy, dz = (p-ankle).T
        foot = (1-smooth(.20, .55, dy))*(1-smooth(.15, .45, arm))
        sole = 1-smooth(-.56, -.24, dy)
        medial = bell(dx+s*.16, .20)
        q[:, 1] += .030*medial*bell(dz-.6, .40)*sole*foot
        q[:, 2] -= .018*bell(dx, .23)*bell(dy+.22, .23)*bell(dz+.25, .25)*foot

    # Neck terminal plane is stable and clean on both average and fit surfaces.
    fade = smooth(0, .13, abs(p[:, 1]-7.0))
    return p + (q-p)*fade[:, None]


def build(sex):
    meta = json.loads((OUT/f'human-v4-{sex}.json').read_text())
    raw = (OUT/meta['buffer']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta['sha256']
    n = meta['vertexCount']
    data = np.frombuffer(raw[:n*48], dtype='<f4').reshape(n, 12).astype(np.float64)
    field = (OUT/f'muscle-field-v4-{sex}.bin').read_bytes()
    old_indices = np.frombuffer(raw[n*48:], dtype='<u4')
    # Revision 4's terminal ring retained the underside of the chin. Cut below
    # it at an actual neck section, sharing every newly intersected edge vertex.
    vertices = data.tolist()
    influences = np.frombuffer(field[n*4:], dtype=np.uint8).reshape(n,8).tolist()
    colors = np.frombuffer(field[:n*3], dtype=np.uint8).reshape(n,3).tolist()
    identities = list(field[n*3:n*4])
    intersections = {}
    def distance(v,plane):
        if plane=='neck': return v[1]-7.0
        if plane=='leg': return v[1]-.9*(abs(v[0])-1.1)+.5
        joint=meta['joints']['L' if v[0]>=0 else 'R']
        shoulder=np.array(joint['shoulder'])
        axis=np.array(joint['elbow'])-shoulder
        axis/=np.linalg.norm(axis)
        return np.dot(np.array(v[:3])-shoulder,axis)-.85
    def cut(a,b,plane='neck'):
        key = (plane,*sorted((a,b)))
        if key in intersections: return intersections[key]
        da,db=distance(vertices[a],plane),distance(vertices[b],plane)
        t = da/(da-db)
        v = [(1-t)*u+t*w for u,w in zip(vertices[a],vertices[b])]
        if plane=='neck': v[1],v[4] = 7.0,0.0
        index = len(vertices)
        vertices.append(v)
        votes = {}
        for i,weight in [(a,1-t),(b,t)]:
            for group,w in zip(influences[i][:4],influences[i][4:]):
                votes[group] = votes.get(group,0)+w*weight
        top = sorted(votes.items(),key=lambda x:-x[1])[:4]
        top += [(36,0)]*(4-len(top))
        total = sum(w for _,w in top)
        influences.append([g for g,_ in top]+[round(w/total*255) for _,w in top])
        identities.append(255 if top[0][0]==36 else top[0][0])
        colors.append([round((1-t)*u+t*w) for u,w in zip(colors[a],colors[b])])
        intersections[key]=index
        return index
    def clipped(triangles,plane):
        result=[]
        for triangle in triangles:
            poly=[]
            for a,b in zip(triangle,np.roll(triangle,-1)):
                inside_a=distance(vertices[a],plane)<=0
                inside_b=distance(vertices[b],plane)<=0
                if inside_a: poly.append(int(a))
                if inside_a != inside_b: poly.append(cut(int(a),int(b),plane))
            for i in range(1,len(poly)-1): result.extend([poly[0],poly[i],poly[i+1]])
        return result
    parts=[]; offset=0
    for count in meta['partCounts']:
        parts.append(clipped(old_indices[offset:offset+count].reshape(-1,3),'neck'));offset+=count
    # Conform the inherited shoulder/neck T junctions. Splitting the long edge
    # makes both charts share the same vertex rather than hiding a hairline gap.
    edge_faces=defaultdict(list)
    for zone,part in enumerate(parts):
        for i in range(0,len(part),3):
            tri=part[i:i+3]
            for a,b in zip(tri,tri[1:]+tri[:1]): edge_faces[tuple(sorted((a,b)))].append((zone,i))
    boundary={e:fs[0] for e,fs in edge_faces.items() if len(fs)==1}
    neighbors=defaultdict(set)
    for a,b in boundary: neighbors[a].add(b);neighbors[b].add(a)
    for (a,b),(zone,i) in boundary.items():
        for c in neighbors[a]&neighbors[b]:
            pa,pb,pc=[np.array(vertices[k][:3]) for k in [a,b,c]]
            axis=pb-pa;size=np.dot(axis,axis)
            if size<1e-12:continue
            t=np.dot(pc-pa,axis)/size
            if .001<t<.999 and np.linalg.norm(pc-pa-axis*t)<.00005:
                tri=parts[zone][i:i+3]
                for k in range(3):
                    u,v,w=tri[k:]+tri[:k]
                    if {u,v}=={a,b}:
                        parts[zone][i:i+3]=[u,c,w]
                        parts[zone].extend([c,v,w])
                        break
                break
    # Isolated legs use a clean oblique proximal plane below the groin. The
    # continuous body keeps the complete pelvis and its original connectivity.
    for zone in [3,4]: parts.append(clipped(np.array(parts[zone]).reshape(-1,3),'leg'))
    # A torso-only template retains the deltoid/axillary transition but ends
    # above the upper arm. Dedicated triangles leave full-body/arm charts intact.
    torso=parts[0].copy()
    for zone in [1,2]: torso.extend(clipped(np.array(parts[zone]).reshape(-1,3),'shoulder'))
    parts.append(torso)
    data=np.array(vertices)
    data[:,4]*=smooth(0,.20,abs(data[:,1]-7.0))
    data[:,4]*=smooth(0,.24,abs(data[:,1]-.6))
    active_neck=data[:,1]<=7.0
    data[active_neck,4]=np.minimum(data[active_neck,4],7.0-data[active_neck,1])
    n=len(data)
    original = data.copy()
    average = sculpt(data[:, :3], data[:, 6:], meta['joints'], sex, 0)
    fit = sculpt(data[:, :3]+data[:, 3:6], data[:, 6:], meta['joints'], sex, 1)
    data[:, :3] = average
    data[:, 3:6] = fit-average
    assert np.isfinite(data).all()
    triangles = np.array([i for part in parts for i in part],dtype='<u4').reshape(-1,3)
    # Reject flipped faces from any sculpt; tiny source degeneracies are ignored.
    for t in [0, .5, 1]:
        old = original[:, :3]+original[:, 3:6]*t
        new = data[:, :3]+data[:, 3:6]*t
        a, b = old[triangles], new[triangles]
        an = np.cross(a[:, 1]-a[:, 0], a[:, 2]-a[:, 0])
        bn = np.cross(b[:, 1]-b[:, 0], b[:, 2]-b[:, 0])
        valid = np.linalg.norm(an, axis=1)>1e-9
        assert (np.sum(an[valid]*bn[valid], axis=1)>0).all(), (sex, t, 'inverted face')
    blob = data.astype('<f4').tobytes()+triangles.tobytes()
    name = f'human-v5-{sex}'
    (OUT/f'{name}.bin').write_bytes(blob)
    meta.update(version=5, vertexCount=n, partCounts=[len(p) for p in parts], sectionLegParts=True, sectionTorsoPart=True, buffer=name+'.bin', sha256=hashlib.sha256(blob).hexdigest(),
                parent=f'human-v4-{sex}',
                refinement='Continuous rectus planes, reference-led soft-tissue proportions, pectoral and scapular transitions, deltoid/forearm and foot landmarks. Shared topology and atlas retained.')
    (OUT/f'{name}.json').write_text(json.dumps(meta, indent=2)+'\n')
    # This field is still the registered CC BY-SA atlas, with no relabeling.
    field = np.array(colors,dtype=np.uint8).tobytes()+bytes(identities)+np.array(influences,dtype=np.uint8).tobytes()
    fieldmeta = json.loads((OUT/f'muscle-field-v4-{sex}.json').read_text())
    fieldmeta.update(format=5,vertexCount=n,sha256=hashlib.sha256(field).hexdigest(), modifications=fieldmeta['modifications']+' Revision 5 retains vertex identities and interpolates categorical weights at neck, isolated-leg and torso shoulder cuts.')
    (OUT/f'muscle-field-v5-{sex}.bin').write_bytes(field)
    (OUT/f'muscle-field-v5-{sex}.json').write_text(json.dumps(fieldmeta, indent=2)+'\n')
    maximum = max(np.linalg.norm(average-original[:, :3], axis=1).max(),
                  np.linalg.norm(fit-original[:, :3]-original[:, 3:6], axis=1).max())*100
    print(f'{sex}: {n} vertices, {len(triangles)} triangles, max sculpt displacement {maximum:.2f} mm', flush=True)


if __name__ == '__main__':
    for sex in ['male', 'female']:
        build(sex)
    manifest = {f.name: hashlib.sha256(f.read_bytes()).hexdigest()
                for folder in [ROOT/'assets/anatomy/source', OUT]
                for f in sorted(folder.iterdir()) if f.is_file()}
    (ROOT/'assets/anatomy/hashes.json').write_text(json.dumps(manifest, indent=2)+'\n')
