"""Body revision 6: rig-ready surface cleanup and pectoral profile rebuild.

Read immutable v5 assets, preserve every index, weight and anatomy identity.
No reference image pixels or commercial meshes are included. Coordinates: dm.
"""
from pathlib import Path
import hashlib
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'
def bell(x,r): return np.exp(-np.minimum(80,(x/r)**2))
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)
def sculpt(p,w,sex,fit,clean,joints):
    """Rebase problematic regions onto the unlayered subdivision surface.

    A monotone longitudinal profile defines the male pec as a continuous fan;
    it replaces the stacked bumps rather than adding another displacement layer.
    Hands, feet, abdomen and the stable section/atlas identities are retained.
    """
    from scipy.interpolate import PchipInterpolator
    x,y,z=p.T; ax=np.abs(x)
    arm=np.maximum(w[:,0],w[:,3])
    trunk=(1-smooth(.04,.40,arm))*smooth(.9,1.5,y)
    back=(1-smooth(-.65,-.15,z))*trunk*smooth(1.6,2.3,y)*(1-smooth(5.9,6.5,y))
    replacement=back*.90
    for side,k in [('L',0),('R',3)]:
        sh,el,wr=[np.array(joints[side][n]) for n in ['shoulder','elbow','wrist']]
        axis=wr-sh;length=np.linalg.norm(axis);axis/=length
        t=np.sum((p-sh)*axis,axis=1)/length
        # Remove the repeated triceps/deltoid grooves while keeping wrist detail.
        replacement=np.maximum(replacement,w[:,k]*.88*smooth(.0,.12,t)*(1-smooth(.72,.94,t)))
    front=smooth(.25,.85,z)*trunk
    if sex=='male':
        chest=front*smooth(4.05,4.4,y)*(1-smooth(5.9,6.22,y))
        replacement=np.maximum(replacement,chest)
    q=p+(clean-p)*replacement[:,None]
    if sex=='male':
        # Inferior edge curves up toward the sternum and the humeral insertion.
        lower=4.61+.19*((ax-.85)/.90)**2
        height=y-(lower-4.61)
        levels=[4.0,4.2,4.4,4.5,4.6,4.7,4.85,5.05,5.25,5.45,5.65,5.9,6.2]
        source=[1.09,1.17,1.30,1.36,1.39,1.41,1.44,1.43,1.37,1.27,1.13,.93,.76]
        target=[1.09,1.15,1.20,1.22,1.29,1.43,1.50,1.51,1.47,1.35,1.20,.95,.76]
        profile=PchipInterpolator(levels,np.array(target)-source,extrapolate=False)
        delta=np.nan_to_num(profile(height))
        width=smooth(.04,.30,ax)*(1-smooth(1.35,1.90,ax))
        q[:,2]+=delta*width*front*(.20+.80*fit)
    # Freeze the terminal neck rim, including vertices interpolated at the cut.
    fade=smooth(0,.15,abs(y-7.0))
    return p+(q-p)*fade[:,None]

report=[]
for sex in ['male','female']:
    meta=json.loads((OUT/f'human-v5-{sex}.json').read_text())
    raw=(OUT/meta['buffer']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==meta['sha256']
    n=meta['vertexCount']; original=np.frombuffer(raw[:n*48],'<f4').reshape(n,12).astype('float64')
    data=original.copy()
    clean=np.load(ROOT/f'.tools/anatomy/rig-v5-{sex}.npy')[:,-6:]
    assert len(clean)==n
    average=sculpt(data[:,:3],data[:,6:],sex,0,clean[:,:3],meta['joints'])
    fit=sculpt(data[:,:3]+data[:,3:6],data[:,6:],sex,1,clean[:,:3]+clean[:,3:6],meta['joints'])
    data[:,:3]=average;data[:,3:6]=fit-average
    # Exactly preserve untouched vertices, not merely within a tolerance.
    untouched=np.all(average==original[:,:3],axis=1)&np.all(fit==original[:,:3]+original[:,3:6],axis=1)
    data[untouched]=original[untouched]
    tri=np.frombuffer(raw[n*48:],'<u4').reshape(-1,3)
    for t in [0,.25,.5,.75,1]:
        a=(original[:,:3]+original[:,3:6]*t)[tri];b=(data[:,:3]+data[:,3:6]*t)[tri]
        an=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);bn=np.cross(b[:,1]-b[:,0],b[:,2]-b[:,0])
        valid=np.linalg.norm(an,axis=1)>1e-9
        assert (np.sum(an[valid]*bn[valid],axis=1)>0).all(),(sex,t,'inverted face')
    blob=data.astype('<f4').tobytes()+raw[n*48:]
    name=f'human-v6-{sex}'
    (OUT/f'{name}.bin').write_bytes(blob)
    meta.pop('occlusion',None)
    meta.update(version=6,buffer=name+'.bin',sha256=hashlib.sha256(blob).hexdigest(),parent=f'human-v5-{sex}',
      refinement='Rebased posterior thorax and arm surfaces onto the unlayered CC0 subdivision mesh; rebuilt male pectoral profile. Exact revision 5 indices and categorical fields; full skeleton and preserved chart positions are in the rig sidecar.')
    (OUT/f'{name}.json').write_text(json.dumps(meta,indent=2)+'\n')
    field=(OUT/f'muscle-field-v5-{sex}.bin').read_bytes()
    (OUT/f'muscle-field-v6-{sex}.bin').write_bytes(field)
    fm=json.loads((OUT/f'muscle-field-v5-{sex}.json').read_text())
    fm.update(format=6,modifications=fm['modifications']+' Revision 6 preserves the exact revision 5 categorical field and weights on the refined surface.')
    (OUT/f'muscle-field-v6-{sex}.json').write_text(json.dumps(fm,indent=2)+'\n')
    delta=max(np.linalg.norm(average-original[:,:3],axis=1).max(),np.linalg.norm(fit-original[:,:3]-original[:,3:6],axis=1).max())*100
    report.append({'sex':sex,'vertices':n,'triangles':len(tri),'maxDisplacementMmAtNativeScale':float(delta),'topologyUnchanged':True,'invertedFaces':0})
manifest=json.loads((ROOT/'assets/anatomy/hashes.json').read_text())
for f in OUT.iterdir():
    if f.is_file():manifest[f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
(ROOT/'assets/anatomy/hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(report,indent=2))
