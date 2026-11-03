"""Versioned fit/average surfaces. Independent converter of CC0 MakeHuman assets.
The v1 mesh is deliberately left untouched. All interpolated channels share topology.
"""
import json, math, pathlib, hashlib, array, runpy, sys
sculpt_functions=runpy.run_path(str(pathlib.Path(__file__).with_name("surface-sculpt.py")))
sculpt=sculpt_functions["sculpt"]; bony_landmarks=sculpt_functions["bony_landmarks"]
R=pathlib.Path(__file__).resolve().parents[1]; S=R/'assets/anatomy/source'; OUT=R/'public/anatomy'
(R/'.tools/anatomy').mkdir(parents=True,exist_ok=True)
OUT.mkdir(parents=True,exist_ok=True)
base=[]; faces=[]; group=''
for l in (S/'base.obj').read_text().splitlines():
 s=l.split()
 if not s:continue
 if s[0]=='v':base.append(list(map(float,s[1:])))
 if s[0]=='g':group=s[1]
 if s[0]=='f' and group=='body':faces.append([int(x.split('/')[0])-1 for x in s[1:]])
def target(name):
 d=[[0.,0.,0.] for _ in base]
 for l in (S/name).read_text().splitlines():
  s=l.split()
  if len(s)==4 and s[0].isdigit():d[int(s[0])]=list(map(float,s[1:]))
 return d
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):return [x/max(1e-12,math.sqrt(dot(a,a))) for x in a]
def rot(p,pivot,axis,angle):
 q=sub(p,pivot);c=math.cos(angle);s=math.sin(angle);cr=cross(axis,q);dt=dot(axis,q)
 return [pivot[i]+q[i]*c+cr[i]*s+axis[i]*dt*(1-c) for i in range(3)]
def avg(points):return [sum(p[i] for p in points)/len(points) for i in range(len(points[0]))]
def subdivide(data,faces):
 fps=[avg([data[i] for i in f]) for f in faces];edges={};vf=[[] for _ in data];ve=[set() for _ in data]
 for fi,f in enumerate(faces):
  for a,b in zip(f,f[1:]+f[:1]):
   key=tuple(sorted((a,b)));edges.setdefault(key,[]).append(fi);ve[a].add(key);ve[b].add(key)
  for a in f:vf[a].append(fi)
 out=[]
 for i,p in enumerate(data):
  boundary=[b if a==i else a for a,b in ve[i] if len(edges[a,b])==1]
  if boundary:out.append([(6*p[c]+sum(data[j][c] for j in boundary))/8 for c in range(len(p))]);continue
  n=len(vf[i]);F=avg([fps[k] for k in vf[i]]);E=avg([avg([data[a],data[b]]) for a,b in ve[i]])
  out.append([(F[c]+2*E[c]+(n-3)*p[c])/n for c in range(len(p))])
 ei={}
 for (a,b),fs in edges.items():
  ei[a,b]=len(out);out.append(avg([data[a],data[b]]+([fps[i] for i in fs] if len(fs)>1 else [])))
 fpidx=len(out);out+=fps;quads=[]
 for fi,f in enumerate(faces):
  for j,a in enumerate(f):quads.append([a,ei[tuple(sorted((a,f[(j+1)%len(f)])))],fpidx+fi,ei[tuple(sorted((f[j-1],a)))]] )
 return out,quads
sk=json.loads((S/'default.mhskel').read_text());weights=json.loads((S/'default_weights.mhw').read_text())['weights']
def desc(b,root):
 while b:
  if b==root:return True
  b=sk['bones'][b]['parent']
 return False
channels=[[0.]*6 for _ in base]
for side,k in [('L',0),('R',3)]:
 for b,ws in weights.items():
  flags=[desc(b,'upperarm01.'+side),desc(b,'lowerarm01.'+side),desc(b,'lowerleg01.'+side)]
  for i,w in ws:
   for c,flag in enumerate(flags):
    if flag:channels[i][k+c]+=w

def build(sex):
 macro=target(f'caucasian-{sex}-young.target');bulk=target(f'universal-{sex}-young-maxmuscle-averageweight.target');fat=target(f'universal-{sex}-young-averagemuscle-maxweight.target');neutral=target(f'universal-{sex}-young-averagemuscle-averageweight.target')
 v=[[p[c]+macro[i][c]+neutral[i][c]+fat[i][c]*.20 for c in range(3)] for i,p in enumerate(base)]
 fit=[[p[c]+macro[i][c]+bulk[i][c] for c in range(3)] for i,p in enumerate(base)]
 details={'stomach-tone-incr.target':.85 if sex=='male' else .55,'torso-muscle-pectoral-incr.target':.15 if sex=='male' else .05,'torso-muscle-dorsi-incr.target':.35}
 for side in ['l','r']:
  for part in ['upperarm','lowerarm','upperleg','lowerleg','upperarm-shoulder']:details[side+'-'+part+'-muscle-incr.target']=.25 if sex=='male' else .12
 for name,amount in details.items():
  delta=target(name)
  fit=[[p[c]+delta[i][c]*amount for c in range(3)] for i,p in enumerate(fit)]
 overrides={}
 if sex=='female':
  # Normalize section landmarks to the shared chart frame. The source female has a
  # shorter trunk; a fixed world-height crop would otherwise retain part of her head.
  original={n+'.'+side:avg([v[i] for i in sk['joints'][sk['bones'][n+'.'+side]['head']]]) for side in ['L','R'] for n in ['upperarm01','lowerarm01','wrist','upperleg01','lowerleg01','foot']+[f'finger{f}-{k}' for f in range(1,6) for k in range(1,4)]}
  knots=[(-8.5,-8.5),(original['foot.L'][1],-7.457725),(original['lowerleg01.L'][1],-3.108825),(original['upperleg01.L'][1],1.15215),(original['upperarm01.L'][1],5.81505),(12,12+5.81505-original['upperarm01.L'][1])]
  def mapy(y):
   for (a,b),(c,d) in zip(knots,knots[1:]):
    if y<=c:return b+(y-a)*(d-b)/(c-a)
   return y+knots[-1][1]-knots[-1][0]
  for points in [v,fit]:
   for i,p in enumerate(points):
    p=p[:]
    for side,k in [('L',0),('R',3)]:
     sh=original['upperarm01.'+side];w=channels[i][k]
     p=[p[c]+(p[c]-sh[c])*.14*w for c in range(3)]
    p[1]=mapy(p[1]);points[i]=p
  for name,p in original.items():
   p=p[:]
   if name.startswith(('lowerarm01','wrist','finger')):
    sh=original['upperarm01.'+name[-1]];p=[sh[c]+(p[c]-sh[c])*1.14 for c in range(3)]
   p[1]=mapy(p[1]);overrides[name]=p
 def joint(b):return overrides.get(b) or avg([v[i] for i in sk['joints'][sk['bones'][b]['head']]])
 joints={};hands={}
 for side,k in [('L',0),('R',3)]:
  sh,el,wr,hip,kn,ank=[joint(n+'.'+side) for n in ['upperarm01','lowerarm01','wrist','upperleg01','lowerleg01','foot']]
  a=norm(sub(wr,el));b=norm(sub(el,sh));ax=norm(cross(a,b));angle=math.acos(max(-1,min(1,dot(a,b))))
  hands[side]=[[rot(joint(f'finger{f}-{k}.'+side),el,ax,angle) for k in range(1,4)] for f in range(1,6)]
  for i in range(len(v)):
   w=channels[i][k+1]
   if w:
    for vs in [v,fit]:
     p=vs[i];q=rot(p,el,ax,angle);vs[i]=[p[z]*(1-w)+q[z]*w for z in range(3)]
  joints[side]={'shoulder':sh,'elbow':el,'wrist':rot(wr,el,ax,angle),'hip':hip,'knee':kn,'ankle':ank}
 used=sorted(set(i for f in faces for i in f));mapping={i:j for j,i in enumerate(used)}
 data=[v[i]+sub(fit[i],v[i])+channels[i] for i in used];fs=[[mapping[i] for i in f] for f in faces]
 for _ in range(2):data,fs=subdivide(data,fs)
 for vtx in data:
  fitpoint=bony_landmarks(sculpt([vtx[c]+vtx[c+3] for c in range(3)],vtx[6:12],joints,sex),joints,hands)
  vtx[:3]=bony_landmarks(vtx[:3],joints,hands)
  vtx[3:6]=[fitpoint[c]-vtx[c] for c in range(3)]
  # Ease vertical morph motion into each cut plane. Fixing only the final ring
  # lets neighboring vertices cross that ring, producing a ragged silhouette.
  cut_distance=min(abs(vtx[1]-1.2),abs(vtx[1]-6.9),abs(vtx[1]-.6))
  t=min(1,cut_distance/.28);vtx[4]*=t*t*(3-2*t)
  # A clean proximal plane removes the hanging axillary sliver made by a weight-only cut.
  vtx.extend([min(vtx[0]-(joints['L']['shoulder'][0]-.18), (vtx[6]-.04)*3), min(-vtx[0]-(-joints['R']['shoulder'][0]-.18), (vtx[9]-.04)*3)])
 def clip(poly,channel,cut,sign):
  result=[]
  for a,b in zip(poly,poly[1:]+poly[:1]):
   da=(a[channel]-cut)*sign;db=(b[channel]-cut)*sign
   if da>=0:result.append(a)
   if (da>=0)!=(db>=0):
    t=da/(da-db);result.append([u+(w-u)*t for u,w in zip(a,b)])
  return result
 vs=[];lookup={};parts=[[] for _ in range(5)]
 for f in fs:
  poly=[data[i] for i in f];pieces=[]
  for zone,channel in [(1,12),(2,13)]:
   pieces.append((zone,clip(poly,channel,0,1)));poly=clip(poly,channel,0,-1)
  pieces.append((0,clip(clip(poly,1,1.2,1),1,6.9,-1)))
  for zone,sign in [(3,1),(4,-1)]:pieces.append((zone,clip(clip(poly,1,.6,-1),0,.55*sign,sign)))
  for zone,p in pieces:
   for j in range(1,len(p)-1):
    for q in [p[0],p[j],p[j+1]]:
     # Keep cut rings planar under the fit morph as well as the average surface.
     if zone==0 and (abs(q[1]-1.2)<1e-5 or abs(q[1]-6.9)<1e-5):q=q[:];q[4]=0
     if zone>=3 and abs(q[1]-.6)<1e-5:q=q[:];q[4]=0
     key=tuple(round(x,6) for x in q[:12])
     if key not in lookup:lookup[key]=len(vs);vs.append(list(key))
     parts[zone].append(lookup[key])
 # Float32 interleaved positions/deltas/rig weights, followed by packed Uint32 triangle indices.
 coordinates=array.array('f',[x for v in vs for x in v]);triangles=array.array('I',[x for p in parts for x in p])
 if sys.byteorder!='little':coordinates.byteswap();triangles.byteswap()
 blob=coordinates.tobytes()+triangles.tobytes()
 name=f'human-v2-{sex}';(OUT/(name+'.bin')).write_bytes(blob)
 meta={'version':2,'provenance':'MakeHuman core CC0; '+(S/'revision.txt').read_text().strip(),'vertexCount':len(vs),'partCounts':[len(p) for p in parts],'joints':joints,'buffer':name+'.bin','sha256':hashlib.sha256(blob).hexdigest()}
 (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
 # Local bake input, never shipped. This lets the anatomical field be regenerated against this exact surface.
 (R/'.tools/anatomy'/f'{sex}-surface.json').write_text(json.dumps({'vertices':vs,'parts':parts,'joints':joints},separators=(',',':')))
 print(sex,len(vs),'vertices',sum(len(p)//3 for p in parts),'triangles',len(blob),'bytes',flush=True)
for sex in ['male','female']:build(sex)
manifest={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(S.iterdir()) if f.is_file()}
manifest.update({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(OUT.iterdir()) if f.is_file()})
(R/'assets/anatomy/hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
