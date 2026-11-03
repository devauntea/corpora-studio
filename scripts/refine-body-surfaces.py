"""Author the third body revision without modifying the shipped v1/v2 assets.

Geometry is derived from CC0 MakeHuman surfaces. Atlas boundary/direction fields
are adaptations of the existing CC BY-SA 4.0 Z-Anatomy fields. Units are dm.
No runtime dependency on Python, Blender, or downloaded assets.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'
SOURCE = ROOT / 'assets/anatomy/source'

def dot(a, b): return sum(x*y for x, y in zip(a, b))
def sub(a, b): return [x-y for x, y in zip(a, b)]
def add(a, b): return [x+y for x, y in zip(a, b)]
def mul(a, b): return [x*b for x in a]
def length(a): return math.sqrt(dot(a, a))
def norm(a): return mul(a, 1/max(1e-10, length(a)))
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def gauss(v, r): return math.exp(-min(100, (v/r)**2))
def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)
def segment(p, a, b):
    axis = sub(b, a); size = length(axis); axis = mul(axis, 1/size)
    t = dot(sub(p, a), axis)/size
    off = sub(sub(p, a), mul(axis, t*size))
    return t, off, length(off)
def rotate(p, pivot, axis, angle):
    q = sub(p, pivot); co = math.cos(angle); si = math.sin(angle)
    return add(pivot, add(add(mul(q, co), mul(cross(axis, q), si)), mul(axis, dot(axis, q)*(1-co))))

def hand_frames(sex):
    """Reconstruct the same CC0 landmark frame used by the v2 converter."""
    base = [list(map(float, line.split()[1:])) for line in (SOURCE/'base.obj').read_text().splitlines() if line.startswith('v ')]
    for name, weight in [(f'caucasian-{sex}-young.target', 1), (f'universal-{sex}-young-averagemuscle-averageweight.target', 1), (f'universal-{sex}-young-averagemuscle-maxweight.target', .2)]:
        for line in (SOURCE/name).read_text().splitlines():
            bits = line.split()
            if len(bits) == 4 and bits[0].isdigit():
                i = int(bits[0]); base[i] = add(base[i], mul(list(map(float, bits[1:])), weight))
    sk = json.loads((SOURCE/'default.mhskel').read_text())
    def joint(name, end='head'):
        ids = sk['joints'][sk['bones'][name][end]]
        return [sum(base[i][c] for i in ids)/len(ids) for c in range(3)]
    def normalize(p, side, limb=False):
        if sex != 'female': return p
        sh = joint('upperarm01.'+side)
        if limb: p = add(sh, mul(sub(p, sh), 1.14))
        knots = [(-8.5, -8.5), (joint('foot.L')[1], -7.457725), (joint('lowerleg01.L')[1], -3.108825), (joint('upperleg01.L')[1], 1.15215), (joint('upperarm01.L')[1], 5.81505), (12, 12+5.81505-joint('upperarm01.L')[1])]
        p = p[:]
        for (a, b), (c, d) in zip(knots, knots[1:]):
            if p[1] <= c:
                p[1] = b+(p[1]-a)*(d-b)/(c-a); break
        return p
    result = {}
    for side in ['L', 'R']:
        sh = normalize(joint('upperarm01.'+side), side)
        el = normalize(joint('lowerarm01.'+side), side, True)
        wr = normalize(joint('wrist.'+side), side, True)
        a, b = norm(sub(wr, el)), norm(sub(el, sh))
        axis, angle = norm(cross(a, b)), math.acos(max(-1, min(1, dot(a, b))))
        fingers = [[rotate(normalize(joint(f'finger{f}-{k}.'+side), side, True), el, axis, angle) for k in [1, 2, 3]] + [rotate(normalize(joint(f'finger{f}-3.'+side, 'tail'), side, True), el, axis, angle)] for f in range(1, 6)]
        wrist = rotate(wr, el, axis, angle)
        n = norm(cross(sub(fingers[1][0], fingers[4][0]), sub(fingers[2][0], wrist)))
        if n[0]*(1 if side == 'L' else -1) < 0: n = mul(n, -1)
        toes = []
        for toe in range(1,6):
            count = 2 if toe == 1 else 3
            points = [normalize(joint(f'toe{toe}-{k}.'+side),side) for k in range(1,count+1)]
            points.append(normalize(joint(f'toe{toe}-{count}.'+side,'tail'),side))
            if len(points)<4: points.append(points[-1])
            toes.append(points)
        result[side] = {'wrist': wrist, 'fingers': fingers, 'normal': n, 'toes':toes}
    return result

def hand_detail(p, frame):
    """Extensor cords, knuckle pads and flexion folds on the actual hand frame."""
    wr, fingers, n = frame['wrist'], frame['fingers'], frame['normal']
    if length(sub(p, wr)) > 2.2: return [0, 0, 0], 0
    h = dot(sub(p, wr), n)
    dorsal = smooth(.015, .12, h)
    palmar = 1-smooth(-.12, -.015, h)
    relief = 0.; crease = 0.
    for f, finger in enumerate(fingers):
        if f:
            # Four extensor tendons diverge from the dorsal wrist to the MCPs.
            origin = add(wr, mul(sub(fingers[2][0], wr), .10))
            t, off, r = segment(p, origin, finger[0])
            lateral = length(sub(off, mul(n, dot(off, n))))
            if 0 < t < 1:
                relief += .026*gauss(lateral, .035)*math.sin(math.pi*t)**.7*dorsal
        for k in [1, 2]:
            a, b = finger[k-1], finger[k+1]
            axis = norm(sub(b, a)); q = sub(p, finger[k])
            along = dot(q, axis); across = sub(q, mul(axis, along))
            ph = dot(across, n); width = length(sub(across, mul(n, ph)))
            gate = gauss(width, .11 if f else .14)*gauss(ph, .22)
            relief += .014*gauss(along, .07)*gate*dorsal
            crease -= (.17*gauss(along-.035, .016)+.11*gauss(along+.035, .014))*gate*max(dorsal*.7, palmar)
        # Subtle nail-bed dome, kept on the distal digit rather than the palm.
        a, b = finger[2], finger[3]
        t, off, r = segment(p, a, b)
        lateral = length(sub(off, mul(n, dot(off, n))))
        if 0 < t < 1:
            relief += .010*gauss(t-.61, .23)*gauss(lateral, .07)*dorsal
    palm_axis = norm(sub(fingers[2][0], wr))
    across_axis = norm(cross(palm_axis, n))
    u, v = dot(sub(p, wr), across_axis), dot(sub(p, wr), palm_axis)
    if -.15 < v < .65:
        crease -= .14*gauss(v-.03-.10*u, .018)*gauss(u, .29)*palmar
        crease -= .11*gauss(v-.14-.08*u, .018)*gauss(u, .27)*palmar
        crease -= .20*gauss(v-.45-.24*u, .022)*gauss(u, .35)*palmar
    return mul(n, relief), crease

def refine(p, weights, joints, hands, sex, fit):
    x, y, z = p; ax = abs(x); sign = 1 if x >= 0 else -1
    side = 'L' if x >= 0 else 'R'; j = joints[side]
    arm = max(weights[0], weights[3]); result = p[:]
    muscle = (.45 if sex == 'female' else 1) * fit
    front = smooth(.25, .85, z); back = 1-smooth(-.65, -.15, z)
    trunk = (1-smooth(.06, .45, arm))*smooth(.8, 1.4, y)
    dz = 0.; dx = 0.
    if trunk > .001:
        # Broad planes are shaped before the smaller transitions, avoiding a ball-like chest.
        if sex == 'male':
            dz += fit*(.085*gauss(ax-.95, .80)*gauss(y-5.45, .43)-.050*gauss(ax-.85, .65)*gauss(y-4.70, .34))*front
            lower = 4.43+.12*ax-.075*ax*ax
            dz -= (.004+.008*fit)*gauss(y-lower, .10)*gauss(ax-.85, .68)*front
            dz -= .025*fit*gauss(ax-(1.84-.32*(5.75-y)), .10)*gauss(y-5.35, .48)*front
        # Palpable clavicles and the suprasternal notch exist on both builds.
        clav = 5.98+.11*math.sin((ax-.2)*2.1)
        dz += (.028+.025*fit)*gauss(y-clav, .065)*gauss(ax-.92, .80)*front
        dz -= (.015+.018*fit)*gauss(y-clav+.13, .075)*gauss(ax-1.03, .78)*front
        dz -= .040*gauss(x, .17)*gauss(y-6.23, .18)*front
        scm_x = .22+(y-6.05)*.36
        dz += .033*gauss(ax-scm_x, .075)*gauss(y-6.54, .48)*front
        # Abdominal intersections, semilunar border and serratus interdigitations.
        for level, width in [(3.74, .44), (3.12, .44), (2.48, .39)]:
            dz -= .014*muscle*gauss(y-level-.025*math.sin(ax*4), .08)*gauss(ax-.40, width)*front
        dz -= .016*muscle*gauss(ax-(.80-.045*(3.3-y)), .09)*gauss(y-3.28, 1.05)*front
        dz -= .020*muscle*gauss(x, .065)*gauss(y-3.3, 1.3)*front
        for i in range(4):
            yy = 4.55-i*.255-.48*(ax-1.15)
            dz += muscle*(.012*gauss(y-yy, .14)-.004*gauss(y-yy+.15, .08))*gauss(ax-1.28, .28)*front
        dz += .035*muscle*gauss(ax-(1.22-.12*(3.4-y)), .16)*gauss(y-3.3, .8)*front
        dz -= .010*muscle*gauss(y-(1.7+.6*(ax-.55)), .11)*gauss(ax-1.05, .45)*front
        # Scapular spine, medial border, lower tip and erector columns.
        scap = 5.48-.37*ax
        dz -= (.018+.040*muscle)*gauss(y-scap, .075)*gauss(ax-1, .64)*back
        dz += .035*muscle*gauss(ax-(.56+.16*(5.6-y)), .07)*gauss(y-5.02, .67)*back
        dz -= .040*muscle*gauss(ax-.91, .20)*gauss(y-4.48, .18)*back
        dz -= .045*muscle*gauss(ax-.26, .16)*gauss(y-3.5, 1.4)*back
        dz += .018*gauss(x, .065)*gauss(y-4.7, 1.6)*back
        for level in [3.35, 3.7, 4.05, 4.4, 4.75, 5.1, 5.45, 5.8, 6.15]:
            dz -= .010*gauss(x, .08)*gauss(y-level, .08)*back
        dx += sign*.030*muscle*gauss(ax-1.4, .2)*gauss(y-4.2, .75)
        result[0] += dx*trunk; result[2] += dz*trunk
    if arm > .05:
        t, off, radius = segment(p, j['shoulder'], j['elbow'])
        if radius > .01 and -.1 < t < 1.12:
            theta = math.atan2(off[0]*sign, off[2])
            # Deltoid insertion and the bicipital grooves taper into the elbow.
            d = -.038*muscle*gauss(t-.37, .05)*max(0, math.sin(theta))**2
            d += .045*muscle*gauss(t-.55, .20)*gauss(theta, .65)
            d -= .022*muscle*gauss(t-.60, .27)*(gauss(theta-.80, .13)+gauss(theta+.82, .13))
            d += .026*muscle*gauss(t-.67, .24)*(gauss(abs(theta)-2.35, .45))
            d -= .018*muscle*gauss(t-.70, .24)*gauss(abs(theta)-math.pi, .14)
            # Epicondyles and olecranon retain a hard landmark in Average too.
            d += .030*gauss(t-1.0, .065)*gauss(abs(theta)-1.57, .26)
            d += .025*gauss(t-1.02, .08)*gauss(abs(theta)-math.pi, .40)
            result = add(result, mul(off, d/radius*arm))
        t, off, radius = segment(p, j['elbow'], j['wrist'])
        if radius > .01 and 0 < t < 1.05:
            theta = math.atan2(off[0]*sign, off[2])
            d = .026*muscle*gauss(t-.27, .25)*gauss(theta-.65+.32*t, .22)
            for angle in [-.65, .2, 1.3, 2.1, -2.4]:
                curve = theta-angle-.32*t
                d += (.004+.005*fit)*gauss(curve, .16)*gauss(t-.73, .25)
                d -= .003*muscle*gauss(curve-.20, .12)*gauss(t-.50, .27)
            d += .020*gauss(t-.96, .05)*gauss(abs(theta)-1.5, .3)
            result = add(result, mul(off, d/radius*arm))
        delta, _ = hand_detail(p, hands[side]); result = add(result, delta)
    if y < .8:
        t, off, radius = segment(p, j['hip'], j['knee'])
        if radius > .01 and 0 < t < 1.12:
            theta = math.atan2(off[0]*sign, off[2])
            d = .045*muscle*gauss(t-.47, .30)*gauss(theta, .45)
            d -= .023*muscle*gauss(t-.55, .26)*(gauss(theta-.60, .10)+gauss(theta+.65, .10))
            d += .040*muscle*gauss(t-.84, .12)*gauss(theta+.75, .40)
            d += .024*muscle*gauss(t-.54, .25)*gauss(theta-.95, .35)
            d -= .020*muscle*gauss(t-.60, .28)*gauss(abs(theta)-2.8, .10)
            result = add(result, mul(off, d/radius))
        kx, ky, kz = j['knee']; ankle = j['ankle']
        f = smooth(kz+.18, kz+.40, z)
        result[2] += (.030*gauss(x-kx, .20)*gauss(y-ky, .22)-.016*gauss(y-ky+.27, .055)*gauss(x-kx, .27))*f
        result[2] += .018*gauss(x-kx, .08)*gauss(y-ky+.58, .28)*f
        t, off, radius = segment(p, j['knee'], ankle)
        if radius > .01 and 0 < t < 1:
            theta = math.atan2(off[0]*sign, off[2])
            d = .024*muscle*gauss(t-.35, .20)*(gauss(theta-2.6, .40)+gauss(theta+2.6, .40))
            d -= .025*muscle*gauss(t-.35, .24)*gauss(abs(theta)-math.pi, .10)
            d += (.016+.016*fit)*gauss(t-.47, .37)*gauss(theta+.10, .10)
            d += .018*muscle*gauss(t-.47, .30)*gauss(theta-1.4, .20)
            result = add(result, mul(off, d/radius))
        axx, ay, az = ankle
        # Tibialis/extensor cords on the instep; paired Achilles margins at the rear.
        if ay-.60 < y < ay+.45:
            top = smooth(ay-.4, ay-.08, y)
            for k in [-1, 0, 1, 2]:
                line = axx+k*.11-sign*(z-az)*.06
                result[1] += .013*gauss(x-line, .027)*gauss(z-az-.75, .65)*top
        rear = 1-smooth(az-.25, az-.07, z)
        result[2] += .012*(gauss(x-axx-.13, .035)+gauss(x-axx+.13, .035))*gauss(y-ay-.6, .6)*rear
    # Preserve section planes exactly; all detail fades before the caps.
    distance = min(abs(y-1.2), abs(y-6.9), abs(y-.6))
    fade = smooth(0, .12, distance)
    return add(p, mul(sub(result, p), fade))

def build(sex):
    meta = json.loads((OUT/f'human-v2-{sex}.json').read_text()); n = meta['vertexCount']
    raw = (OUT/meta['buffer']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta['sha256']
    values = array.array('f'); values.frombytes(raw[:n*48])
    indices = array.array('I'); indices.frombytes(raw[n*48:])
    if sys.byteorder != 'little': values.byteswap(); indices.byteswap()
    vertices = [list(values[i*12:i*12+12]) for i in range(n)]
    joints = meta['joints']; hands = hand_frames(sex)
    for v in vertices:
        average = refine(v[:3], v[6:], joints, hands, sex, 0)
        fit = refine(add(v[:3], v[3:6]), v[6:], joints, hands, sex, 1)
        v[:6] = average+sub(fit, average)
    coordinates = array.array('f', [x for v in vertices for x in v])
    if sys.byteorder != 'little': coordinates.byteswap()
    blob = coordinates.tobytes()+raw[n*48:]
    name = f'human-v3-{sex}'
    (OUT/f'{name}.bin').write_bytes(blob)
    meta.update(version=3, buffer=name+'.bin', sha256=hashlib.sha256(blob).hexdigest(), parent=f'human-v2-{sex}', detailLandmarks=hands['L'], refinement='Authored anatomical planes, entheses, joint landmarks, hand tendons and digit folds.')
    (OUT/f'{name}.json').write_text(json.dumps(meta, indent=2)+'\n')
    print(sex, 'surface refined', flush=True)

    fieldmeta = json.loads((OUT/f'muscle-field-v2-{sex}.json').read_text())
    oldfield = (OUT/f'muscle-field-v2-{sex}.bin').read_bytes()
    assert hashlib.sha256(oldfield).hexdigest() == fieldmeta['sha256']
    ids = list(oldfield[n*3:]); neighbors = [set() for _ in range(n)]
    for i in range(0, len(indices), 3):
        a, b, c = indices[i:i+3]
        neighbors[a].update([b,c]); neighbors[b].update([a,c]); neighbors[c].update([a,b])
    # Remove isolated one-ring color flecks while retaining narrow long muscles.
    for _ in range(4):
        newids = ids[:]
        for i, ns in enumerate(neighbors):
            votes = {ids[i]: 1.5}
            for k in ns: votes[ids[k]] = votes.get(ids[k], 0)+1
            winner = max(votes, key=votes.get)
            if votes[winner] >= len(ns)*.60: newids[i] = winner
        ids = newids
    # Compact color/identity compatibility prefix; categorical influences follow.
    colors=bytearray()
    for gid in ids:
        color=fieldmeta['groups'][gid]['color'] if gid != 255 else '#dfd4b5'
        colors.extend(int(color[c:c+2],16) for c in [1,3,5])
    # Smooth categorical probabilities rather than RGB. The renderer sharpens
    # these probabilities into rounded, narrow borders without muddy color bands.
    probabilities = [{36 if gid == 255 else gid: 1.0} for gid in ids]
    for _ in range(8):
        updated = []
        for i, ns in enumerate(neighbors):
            values = {k:v*.50 for k,v in probabilities[i].items()}
            for j in ns:
                for k,v in probabilities[j].items(): values[k] = values.get(k,0)+v*.50/len(ns)
            top = sorted(values.items(),key=lambda item:item[1],reverse=True)[:4]
            total = sum(v for k,v in top)
            updated.append({k:v/total for k,v in top})
        probabilities = updated
    influences = bytearray()
    for prob in probabilities:
        top = sorted(prob.items(),key=lambda item:item[1],reverse=True)
        top += [(36,0)]*(4-len(top))
        influences.extend(k for k,v in top)
        influences.extend(round(v*255) for k,v in top)
    blob = bytes(colors)+bytes(ids)+bytes(influences)
    name = f'muscle-field-v3-{sex}'
    (OUT/f'{name}.bin').write_bytes(blob)
    fieldmeta.update(sha256=hashlib.sha256(blob).hexdigest(), format=3, bytesPerVertex=12, influenceChannels='4 uint8 palette indices (36=connective), then 4 uint8 weights per vertex', modifications='Topology-aware label cleanup and smoothed categorical probabilities; original palette. The renderer adds authored fascicle and connective-tissue detail.')
    (OUT/f'{name}.json').write_text(json.dumps(fieldmeta, indent=2)+'\n')
    print(sex, n, 'vertices;', len(blob), 'field bytes', flush=True)

if __name__ == '__main__':
    for sex in ['male', 'female']: build(sex)
    manifest = {f.name:hashlib.sha256(f.read_bytes()).hexdigest() for folder in [SOURCE,OUT] for f in sorted(folder.iterdir()) if f.is_file()}
    (ROOT/'assets/anatomy/hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
