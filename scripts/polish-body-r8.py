"""Blender surface polish after build-body-revision8.py, before occlusion.

Smooth only anterior chest depth, with feathered weights, for fit male. X/Y,
all section rims, indices, charts and rig channels are unchanged. Blender's
Smooth modifier softens transitions in the authored replacement contour.
"""
from pathlib import Path
import hashlib
import json
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

sex='male'
path=OUT/f'human-v8-{sex}.json'
meta=json.loads(path.read_text())
assert 'polish' not in meta, 'Already polished: rerun build-body-revision8.py first'
raw=(OUT/meta['buffer']).read_bytes()
n=meta['vertexCount']
d=np.frombuffer(raw[:n*48],'<f4').reshape(n,12).astype(np.float64)
tris=np.frombuffer(raw[n*48:],'<u4').reshape(-1,3)
count=sum(meta['partCounts'][:6])//3
original=d.copy()
p=d[:,:3]+d[:,3:6]
x,y,z=p.T
mask=(1-smooth(.02,.25,np.maximum(d[:,6],d[:,9])))*smooth(.35,.85,z)*smooth(3.9,4.25,y)*(1-smooth(5.65,6.05,y))
mask*=smooth(.04,.30,abs(x))*(1-smooth(1.4,1.9,abs(x)))
# Every section boundary is explicitly protected.
off=0
for c in meta['partCounts']:
    part=tris[off:off+c//3];off+=c//3
    edges=np.sort(np.concatenate([part[:,[0,1]],part[:,[1,2]],part[:,[2,0]]]),axis=1)
    e,nedge=np.unique(edges,axis=0,return_counts=True)
    mask[e[nedge==1].ravel()]=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mesh=bpy.data.meshes.new('r8 matched topology')
mesh.from_pydata(p.tolist(),[],tris[:count].tolist());mesh.update()
obj=bpy.data.objects.new('Fit male pectoral polish',mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
group=obj.vertex_groups.new(name='Feathered pectoral transition')
for i in np.flatnonzero(mask>1e-6):group.add([int(i)],float(mask[i]),'REPLACE')
modifier=obj.modifiers.new('Smooth authored transition','SMOOTH')
modifier.factor=.65;modifier.iterations=48
modifier.use_x=False;modifier.use_y=False;modifier.use_z=True
modifier.vertex_group=group.name
bpy.ops.object.modifier_apply(modifier=modifier.name)
q=np.empty(n*3,np.float32);obj.data.vertices.foreach_get('co',q)
q=q.reshape(n,3).astype(np.float64)
q[mask==0]=p[mask==0]
d[:,3:6]=q-d[:,:3]
d[mask==0]=original[mask==0]
assert np.isfinite(d).all()
for t in [0,.25,.5,.75,1]:
    a=(original[:,:3]+original[:,3:6]*t)[tris]
    b=(d[:,:3]+d[:,3:6]*t)[tris]
    na=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);nb=np.cross(b[:,1]-b[:,0],b[:,2]-b[:,0])
    valid=np.linalg.norm(na,axis=1)>1e-9
    assert (np.sum(na[valid]*nb[valid],axis=1)>0).all(),('inverted face',t)
blob=d.astype('<f4').tobytes()+raw[n*48:]
(OUT/meta['buffer']).write_bytes(blob)
meta['sha256']=hashlib.sha256(blob).hexdigest()
meta.pop('occlusion',None)
meta['polish']={'tool':f'Blender {bpy.app.version_string}','method':'48 iterations of weighted depth-only smooth; all section rims fixed', 'maxDisplacementMm':float(np.linalg.norm(q-p,axis=1).max()*100)}
path.write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta['polish']),flush=True)
