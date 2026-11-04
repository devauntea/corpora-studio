"""Blender batch: register Z-Anatomy superficial muscles to the v2 skin topology.
Run with --disable-autoexec. Does not execute scripts embedded in the source blend.
Output is a CC BY-SA 4.0 derivative anatomical color/identity field, not a diagnostic atlas.
"""
import bpy,json,math,array,pathlib,hashlib,sys
EXTENDED="--full-body" in sys.argv
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
R=pathlib.Path(__file__).resolve().parents[1]
# Color identity is shared across sides and poses. Independent art direction.
groups=[
 ('Pectoralis major','#cb827b','pectoralis major'),('Rectus abdominis','#be6485','rectus abdominis'),
 ('External oblique','#8582b5','external abdominal oblique'),('Serratus anterior','#c78091','serratus anterior'),
 ('Trapezius','#d18d96','part of trapezius'),('Latissimus dorsi','#8aa6b8','latissimus dorsi'),
 ('Infraspinatus','#98bfb3','infraspinatus'),('Teres major','#b39cbd','teres major'),
 ('Deltoid','#b87da8','part of deltoid'),('Biceps brachii','#9d81c4','biceps brachii'),
 ('Triceps brachii','#8bb9c5','triceps brachii'),('Brachialis','#bb93b0','brachialis muscle'),
 ('Brachioradialis','#a4be83','brachioradialis'),('Pronator teres','#ca9a87','pronator teres'),
 ('Flexor carpi radialis','#9c90bb','flexor carpi radialis'),('Flexor carpi ulnaris','#72ab9e','flexor carpi ulnaris'),
 ('Palmaris longus','#d0ad7e','palmaris longus'),('Finger flexors','#b7a0c5','flexor digitorum superficialis'),
 ('Extensor digitorum','#9791bd','extensor digitorum muscle'),('Extensor carpi radialis','#83b8b4','extensor carpi radialis'),
 ('Extensor carpi ulnaris','#c193a7','extensor carpi ulnaris'),('Thumb extensors','#bfad82','pollicis longus'),
 ('Rectus femoris','#bd849a','rectus femoris'),('Vastus lateralis','#b6bf7d','vastus lateralis'),
 ('Vastus medialis','#9babc5','vastus medialis'),('Sartorius','#cd9787','sartorius'),
 ('Adductors','#a894b9','adductor longus','gracilis','adductor magnus'),
 ('Tensor fasciae latae','#9fb782','tensor fasciae latae'),('Hamstrings','#ae8bba','biceps femoris','semitendinosus','semimembranosus'),
 ('Gastrocnemius','#ba8195','gastrocnemius'),('Soleus','#8bb8aa','soleus'),
 ('Tibialis anterior','#879dc2','tibialis anterior'),('Fibularis','#b3ba87','fibularis longus','fibularis brevis'),
 ('Gluteus','#c58e85','gluteus maximus','gluteus medius'),('Sternocleidomastoid','#8cafb5','sternocleidomastoid'),
 ('Spinal extensors','#aa9bbf','longissimus thoracis','iliocostalis lumborum'),
]
meta=[{'name':n,'color':c} for n,c,*_ in groups]
# Atlas landmarks: centers of actual articular capsule objects in source meters.
def capsule(n):
 o=bpy.data.objects['Articular capsule of '+n+' joint.l'];return sum((o.matrix_world@Vector(c) for c in o.bound_box),Vector())/8
# Source axes x=left, z=up, -y=front. Work in that convention throughout.
def canonical(p):return Vector((p.x,p.z,-p.y))
aSh,aEl,aWr,aHip,aKn=[canonical(capsule(n)) for n in ['glenohumeral','elbow','radiocarpal','hip','knee']]
aAn=Vector((.075,.08,-.02))
def frame(a,b):
 axis=(b-a).normalized(); front=Vector((0,0,1));front=(front-axis*axis.dot(front)).normalized();side=axis.cross(front).normalized();return Matrix((side,axis,front)).transposed()
def map_segment(p,a,b,c,d,width=10):
 src=frame(a,b); dst=frame(c,d);v=src.transposed()@(p-a);v.x*=width;v.z*=width;v.y*=(d-c).length/(b-a).length;return c+dst@v
src=[]
for o in bpy.data.objects:
 if o.type!='MESH' or 'Muscles' not in [c.name for c in o.users_collection]:continue
 name=o.name.lower();gid=next((i for i,g in enumerate(groups) if any(k in name for k in g[2:])),None)
 if gid is None:continue
 vs=[canonical(o.matrix_world@v.co) for v in o.data.vertices]
 o.data.calc_loop_triangles();fs=[tuple(t.vertices) for t in o.data.loop_triangles]
 # The oblique object includes its medial aponeurosis. Exclude that sheet from the colored muscle belly.
 if gid==2:fs=[f for f in fs if sum(abs(vs[i].x) for i in f)/3 > .073]
 cols=[c.name for c in o.users_collection]
 region='arm' if any(c in cols for c in ['Left upper limb','Right upper limb']) else 'leg' if any(c in cols for c in ['Left lower limb','Right lower limb']) else 'trunk'
 src.append((o.name,gid,region,vs,fs))
print('Registered source muscle meshes:',len(src),flush=True)
for sex in ['male','female']:
 skin=json.loads((R/'.tools/anatomy'/(f'{sex}-surface-v4.json' if EXTENDED else f'{sex}-surface.json')).read_text());verts=[];faces=[];ids=[]
 j={k:Vector(v) for k,v in skin['joints']['L'].items()}
 def register(p,region):
  sign=1 if p.x>=0 else -1;p=Vector((abs(p.x),p.y,p.z))
  if region=='arm':
   # Piecewise frames respect different shoulder/elbow/wrist locations, with a smooth joint transition.
   upper=map_segment(p,aSh,aEl,j['shoulder'],j['elbow'],10.6)
   lower=map_segment(p,aEl,aWr,j['elbow'],j['wrist'],9.5)
   t=max(0,min(1,(aEl.y+.045-p.y)/.09));t=t*t*(3-2*t);q=upper.lerp(lower,t)
  elif region=='leg':
   upper=map_segment(p,aHip,aKn,j['hip'],j['knee'],11.3)
   lower=map_segment(p,aKn,aAn,j['knee'],j['ankle'],10.4)
   t=max(0,min(1,(aKn.y+.045-p.y)/.09));t=t*t*(3-2*t);q=upper.lerp(lower,t)
  else:
   q=Vector((p.x*10.5*(j['shoulder'].x/1.88175),(p.y-aHip.y)*(j['shoulder'].y-j['hip'].y)/(aSh.y-aHip.y)+j['hip'].y,p.z*10.5+.15))
  q.x*=sign;return q
 for name,gid,region,vs,fs in src:
  offset=len(verts);verts.extend(register(p,region) for p in vs);faces.extend(tuple(i+offset for i in f) for f in fs);ids.extend([gid]*len(fs))
 tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
 # Sample at a consistent midpoint between the two physiques. Field then follows the skin under all morphs/poses.
 colors=bytearray();identities=bytearray();distances=[]
 for v in skin['vertices']:
  p=Vector([v[c]+v[c+3]*.6 for c in range(3)])
  side='L' if p.x>=0 else 'R';js={k:Vector(q) for k,q in skin['joints'][side].items()}
  if max(v[6],v[9])>.28:a,b=js['shoulder'],js['wrist']
  elif p.y<.8:a,b=js['hip'],js['ankle']
  else:a,b=Vector((0,-10,.15)),Vector((0,10,.15))
  axis=(b-a).normalized();off=p-a;radial=(off-axis*off.dot(axis)).normalized()
  hit,normal,idx,dist=tree.ray_cast(p+radial*2.5,-radial,5)
  if idx is None:hit,normal,idx,dist=tree.find_nearest(p)

  gid=ids[idx] if idx is not None else 255
  color=groups[gid][1] if gid!=255 else '#dfd4b5'
  rgb=[int(color[c:c+2],16) for c in [1,3,5]]
  # Distal hands/feet and exposed joints remain the pale connective layer.
  if dist is None or (hit-p).length>(1.35 if sex=='female' and max(v[6],v[9])<.28 and p.y>.8 else .80):gid=255;rgb=[223,212,181]
  # A muscle source mesh can include its long tendons. Those distal structures
  # are connective tissue, not a continuation of the colored muscle belly.
  arm_axis=(js['wrist']-js['elbow']).normalized()
  hand=(p-js['wrist']).dot(arm_axis)>-.12 and max(v[6],v[9])>.28
  foot=p.y<js['ankle'].y+.38
  achilles=p.y<js['ankle'].y+1.7 and p.z<js['ankle'].z-.16 and abs(p.x-js['ankle'].x)<.28
  patella=abs(p.y-js['knee'].y)<.23 and p.z>js['knee'].z+.38 and abs(p.x-js['knee'].x)<.25
  if hand or foot or (p.y<.8 and (achilles or patella)):gid=255;rgb=[223,212,181]
  # Tendinous intersections and linea alba remain visible between the rectus bellies.
  if gid==1 and p.z>.3:
   border=max(math.exp(-(p.x/.045)**2),max(math.exp(-((p.y-h)/.035)**2) for h in [3.74,3.12,2.48]))
   rgb=[round(c*(1-border*.85)+t*border*.85) for c,t in zip(rgb,[223,212,181])]
  if gid==0 and abs(p.x)<.045:rgb=[223,212,181]

  colors.extend(rgb);identities.append(gid);distances.append(dist or 0)
 # A single conservative neighborhood pass antialiases segmented boundaries.
 neighbors=[set() for _ in skin['vertices']]
 for part in skin['parts']:
  for k in range(0,len(part),3):
   a,b,c=part[k:k+3];neighbors[a].update([b,c]);neighbors[b].update([a,c]);neighbors[c].update([a,b])
 softened=bytearray(colors)
 for i,ns in enumerate(neighbors):
  if ns:
   for c in range(3):softened[i*3+c]=round(colors[i*3+c]*.55+sum(colors[n*3+c] for n in ns)/len(ns)*.45)
 colors=softened
 name=f'muscle-field-v4-base-{sex}' if EXTENDED else f'muscle-field-v2-{sex}';blob=bytes(colors)+bytes(identities)
 (R/('.tools/anatomy' if EXTENDED else 'public/anatomy')/f'{name}.bin').write_bytes(blob)
 (R/('.tools/anatomy' if EXTENDED else 'public/anatomy')/f'{name}.json').write_text(json.dumps({'vertexCount':len(skin['vertices']),'groups':meta,'license':'CC-BY-SA-4.0','source':'Z-Anatomy / BodyParts3D','revision':'679bc9bf746fdc2671398aa3857a8acff263a0fb','sha256':hashlib.sha256(blob).hexdigest()},indent=2)+'\n')
 print(sex,len(blob),'field bytes, average distance',sum(distances)/len(distances),flush=True)

# Refresh the complete manifest after both fields have been baked.
manifest={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for folder in [R/"assets/anatomy/source",R/"public/anatomy"] for f in sorted(folder.iterdir()) if f.is_file()}
(R/"assets/anatomy/hashes.json").write_text(json.dumps(manifest,indent=2)+"\n")
