"""Derive distributable anatomical sections from pinned CC0 MakeHuman data.
Only graphical assets are used; this is an independent mesh conversion pipeline.
Run with Python 3 (stdlib only). Coordinates in source decimeters.
"""
import json, math, pathlib, hashlib
R=pathlib.Path(__file__).resolve().parents[1];S=R/'assets/anatomy/source'
v=[];faces=[];group=''
for l in (S/'base.obj').read_text().splitlines():
 s=l.split()
 if not s: continue
 if s[0]=='v':v.append(list(map(float,s[1:])))
 if s[0]=='g':group=s[1]
 if s[0]=='f' and group=='body': faces.append([int(x.split('/')[0])-1 for x in s[1:]])
def target(name):
 d=[[0.,0.,0.] for _ in v]
 for l in (S/name).read_text().splitlines():
  s=l.split()
  if len(s)==4 and s[0].isdigit():d[int(s[0])]=list(map(float,s[1:]))
 return d
male=target('caucasian-male-young.target');muscle=target('universal-male-young-maxmuscle-averageweight.target')
v=[[a+b for a,b in zip(p,d)] for p,d in zip(v,male)]
sk=json.loads((S/'default.mhskel').read_text());weights=json.loads((S/'default_weights.mhw').read_text())['weights']
def joint(b):
 ids=sk['joints'][sk['bones'][b]['head']];return [sum(v[i][k] for i in ids)/len(ids) for k in range(3)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):return [x/math.sqrt(dot(a,a)) for x in a]
def rot(p,pivot,axis,angle):
 q=sub(p,pivot);c=math.cos(angle);s=math.sin(angle);cr=cross(axis,q);dt=dot(axis,q)
 return [pivot[i]+q[i]*c+cr[i]*s+axis[i]*dt*(1-c) for i in range(3)]
def desc(b,root):
 while b:
  if b==root:return True
  b=sk['bones'][b]['parent']
 return False
joints={};channels=[[0.]*6 for _ in v]
for side,k in [('L',0),('R',3)]:
 sh,el,wr,hip,kn,ank=[joint(n+'.'+side) for n in ['upperarm01','lowerarm01','wrist','upperleg01','lowerleg01','foot']]
 for b,ws in weights.items():
  flags=[desc(b,'upperarm01.'+side),desc(b,'lowerarm01.'+side),desc(b,'lowerleg01.'+side)]
  for i,w in ws:
   for c,flag in enumerate(flags):
    if flag:channels[i][k+c]+=w
 # Straighten the reference elbow; aggregate actual rig weights preserve the transition.
 a=norm(sub(wr,el));b=norm(sub(el,sh));ax=norm(cross(a,b));angle=math.acos(max(-1,min(1,dot(a,b))))
 for i in range(len(v)):
  w=channels[i][k+1]
  if w:
   p=v[i];pm=[p[z]+muscle[i][z] for z in range(3)];q=rot(p,el,ax,angle);qm=rot(pm,el,ax,angle)
   new=[p[z]*(1-w)+q[z]*w for z in range(3)];newm=[pm[z]*(1-w)+qm[z]*w for z in range(3)]
   v[i]=new;muscle[i]=sub(newm,new)
 wr=rot(wr,el,ax,angle)
 joints[side]={'shoulder':sh,'elbow':el,'wrist':wr,'hip':hip,'knee':kn,'ankle':ank}
# One Catmull-Clark pass, interpolating geometry, muscle deltas and rig weights identically.
used=sorted(set(i for f in faces for i in f));mapping={i:j for j,i in enumerate(used)}
data=[v[i]+muscle[i]+channels[i] for i in used];faces=[[mapping[i] for i in f] for f in faces]
def avg(points):return [sum(p[i] for p in points)/len(points) for i in range(len(points[0]))]
fps=[avg([data[i] for i in f]) for f in faces];edges={};vf=[[] for _ in data];ve=[set() for _ in data]
for fi,f in enumerate(faces):
 for a,b in zip(f,f[1:]+f[:1]):
  key=tuple(sorted((a,b)));edges.setdefault(key,[]).append(fi);ve[a].add(key);ve[b].add(key)
 for a in f:vf[a].append(fi)
out=[]
for i,p in enumerate(data):
 n=len(vf[i]);F=avg([fps[k] for k in vf[i]]);E=avg([avg([data[a],data[b]]) for a,b in ve[i]])
 out.append([(F[c]+2*E[c]+(n-3)*p[c])/n for c in range(len(p))])
ei={}
for (a,b),fs in edges.items():
 ei[a,b]=len(out);out.append(avg([data[a],data[b]]+[fps[i] for i in fs]))
fpidx=len(out);out+=fps;quads=[]
for fi,f in enumerate(faces):
 for j,a in enumerate(f):quads.append([a,ei[tuple(sorted((a,f[(j+1)%len(f)])))],fpidx+fi,ei[tuple(sorted((f[j-1],a)))]] )
# Classify whole limbs at the shoulder/hip. Upper-body skin stays connected at shared indices.
verts=out;triangles=[]
def clip(poly, channel, cut, sign):
 result=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=(a[channel]-cut)*sign;db=(b[channel]-cut)*sign
  if da>=0:result.append(a)
  if (da>=0)!=(db>=0):
   t=da/(da-db);result.append([u+(w-u)*t for u,w in zip(a,b)])
 return result
for f in quads:
 poly=[verts[i] for i in f]
 pieces=[]
 for zone,channel in [(1,6),(2,9)]:
  pieces.append((zone,clip(poly,channel,.28,1)))
  poly=clip(poly,channel,.28,-1)
 pieces.append((0,clip(clip(poly,1,1.5,1),1,7.0,-1)))
 for zone,sign in [(3,1),(4,-1)]:
  pieces.append((zone,clip(clip(poly,1,.6,-1),0,.55*sign,sign)))
 for zone,p in pieces:
  for j in range(1,len(p)-1):triangles.append((zone,[p[0],p[j],p[j+1]]))
# Compact; keep shared vertices so smooth normals survive chart boundaries.
vs=[];lookup={};parts=[[] for _ in range(5)]
for zone,tri in triangles:
 for p in tri:
  key=tuple(round(x,6) for x in p)
  if key not in lookup:lookup[key]=len(vs);vs.append(list(key))
  parts[zone].append(lookup[key])
result={'provenance':'MakeHuman core CC0; '+(S/'revision.txt').read_text().strip(),'vertices':vs,'parts':parts,'joints':joints}
p=R/'public/anatomy/human-v1.json';p.write_text(json.dumps(result,separators=(',',':'))+'\n')
print('mesh',len(vs),'vertices; triangles',[len(p)//3 for p in parts],'; bytes',p.stat().st_size)
manifest={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(S.iterdir()) if f.is_file()}
manifest['human-v1.json']=hashlib.sha256(p.read_bytes()).hexdigest();(R/'assets/anatomy/hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
