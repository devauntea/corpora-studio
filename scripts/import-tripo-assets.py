"""Import the November 2026 user-provided Tripo models without changing existing assets.
Blender --background --factory-startup --disable-autoexec --python scripts/import-tripo-assets.py
Preserves source normals, UVs, textures and every triangle. Connected-component analysis
welds a temporary mesh ONLY; exported pose meshes retain the original render vertices.
"""
import bpy, bmesh, hashlib, importlib.util, json, math, shutil
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sculpt_import', ROOT/'scripts/import-sculpt-assets.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
OUT=ROOT/'public/sculpts'; META=ROOT/'assets/sculpts'; ORIGINALS=ROOT/'.tools/sculpts/originals'
PARTS=[
 ('tripo-body-study','Full body study','c6c3567f-9e5c-4cad-afba-8bfc2ab968d3.glb','body',1800,'Full male body with head, hands and feet.'),
 ('tripo-full-body','Full body sculpt','full body model.glb','body',1800,'Alternate full male body with head, hands and feet.'),
 ('tripo-human-anatomy','Human muscle atlas','human anatomy model 3d.glb','body',1800,'Full body with original colored muscle texture.'),
 ('tripo-muscular-arm','Flexed muscular arm','muscular arm 3d model.glb','arm',600,'Bent arm with shoulder, forearm and clenched hand.'),
 ('tripo-muscular-forearm','Extended muscular arm','muscular forearm 3d model.glb','arm',730,'Extended shoulder-to-hand arm from the supplied forearm file.'),
 ('tripo-anatomical-human','Anatomical body study','anatomical human model 3d.glb','body',1800,'Full body anatomy study with original colored muscle texture.'),
]
def load(name):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 src=Path('/Users/bigbobby/Downloads')/name; dest=ORIGINALS/name
 if not dest.exists():shutil.copy2(src,dest)
 if src.exists():
  assert hashlib.sha256(src.read_bytes()).digest()==hashlib.sha256(dest.read_bytes()).digest(), 'Source changed: '+name
 bpy.ops.import_scene.gltf(filepath=str(dest))
 meshes=[o for o in bpy.data.objects if o.type=='MESH']; assert len(meshes)==1
 o=meshes[0];base.set_active(o);world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 return o,dest

def export(o,src,id,name,section,scale,description,group=None,pose=None,component=None):
 lo,hi=base.bounds(o);center=(lo+hi)/2
 for v in o.data.vertices:v.co=(v.co-center)*scale
 o.name=id;o.data.update();base.set_active(o)
 assert len(o.data.materials)==1
 lo,hi=base.bounds(o);dims=hi-lo;height=round(dims.z*1000,2)
 o['sourceFile']=src.name;o['provenance']='User-provided Tripo generation; no license embedded in source.'
 path=OUT/(id+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
 base.render_view(o,OUT/(id+'.png'))
 entry=dict(id=id,name=name,section=section,description=description,heightMm=height,circumferenceMm=1020 if section=='body' else 540 if section=='leg' else 310,chartWidthMm=1020 if section=='body' else 540 if section=='leg' else 310,chartHeightMm=height,author='Devauntae Norman',source='',license='User-provided Tripo generation',sourceFile=src.name,sha256=hashlib.sha256(src.read_bytes()).hexdigest(),file='/sculpts/'+id+'.glb',thumbnail='/sculpts/'+id+'.png',triangleCount=sum(len(p.vertices)-2 for p in o.data.polygons),vertexCount=len(o.data.vertices),dimensionsMm=[round(dims.x*1000,2),height,round(dims.y*1000,2)],units='meters',upAxis='Y',frontAxis='+Z',rigged=False,dimensionsEstimated=True,bytes=path.stat().st_size,outputSha256=hashlib.sha256(path.read_bytes()).hexdigest(),uvMethod='source',provenance='User states these were made using Tripo. Source contains no license; no third-party CC license is inferred.')
 if group:entry.update(groupId=group,groupName='Muscular leg',poseName=pose,sourceComponent=component)
 (META/(id+'.json')).write_text(json.dumps(entry,indent=2)+'\n')
 return entry

entries=[]
for id,name,filename,section,height,description in PARTS:
 o,src=load(filename)
 if id=='tripo-muscular-forearm':
  rotation=Matrix.Rotation(math.pi/2,3,'Y')
  for v in o.data.vertices:v.co=rotation@v.co
 lo,hi=base.bounds(o)
 entries.append(export(o,src,id,name,section,height/1000/(hi.z-lo.z),description))

filename='human leg muscles 3d model.glb'
o,src=load(filename)
# Canonical connectivity on a copy reconnects the exporter's UV/normal seams.
bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
seen=set();components=[]
for v in bm.verts:
 if v in seen:continue
 stack=[v];seen.add(v);component=[]
 while stack:
  q=stack.pop();component.append(q)
  for e in q.link_edges:
   n=e.other_vert(q)
   if n not in seen:seen.add(n);stack.append(n)
 components.append(component)
components.sort(key=lambda c:sum(v.co.x for v in c)/len(c))
assert len(components)==6, f'Expected six complete legs, got {len(components)}'
def key(v):return tuple(round(x,6) for x in v)
labels={key(v.co):i for i,c in enumerate(components) for v in c}
assert len(labels)==len(bm.verts)
# All source vertices/faces must belong to one pose; no triangle slicing.
assign=[labels[key(v.co)] for v in o.data.vertices]
for p in o.data.polygons:assert len({assign[i] for i in p.vertices})==1
original_triangles=sum(len(p.vertices)-2 for p in o.data.polygons)
scale=.98/(max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices))
words=['one','two','three','four','five','six']
for i,word in enumerate(words):
 copy=o.copy();copy.data=o.data.copy();bpy.context.collection.objects.link(copy)
 cut=bmesh.new();cut.from_mesh(copy.data);cut.verts.ensure_lookup_table()
 bmesh.ops.delete(cut,geom=[v for v in cut.verts if assign[v.index]!=i],context='VERTS');cut.to_mesh(copy.data);cut.free()
 # Hide the source and previous objects so thumbnail shows only this leg.
 o.hide_render=True
 copy.hide_render=False
 pose=f'Pose {i+1}'+(' · bent' if i>=4 else ' · standing')
 entries.append(export(copy,src,'tripo-leg-'+word,'Muscular leg · '+pose,'leg',scale,'Single leg with thigh, calf and foot. Original authored pose.',group='tripo-muscular-leg',pose=pose,component=i))
 bpy.data.objects.remove(copy,do_unlink=True)
bm.free()
assert sum(e['triangleCount'] for e in entries if e.get('groupId'))==original_triangles
catalog=json.loads((OUT/'catalog.json').read_text());newids={e['id'] for e in entries}
catalog=[e for e in catalog if e['id'] not in newids]+entries
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
print('Imported',len(entries),'surfaces; six legs grouped under one model.',flush=True)
