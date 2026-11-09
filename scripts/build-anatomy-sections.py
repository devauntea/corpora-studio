"""Derive sections and aligned skin-envelope morphs from the user's anatomy GLB.
Blender --background --factory-startup --disable-autoexec --python scripts/build-anatomy-sections.py
New IDs only: imported originals and existing tattoo anchors remain unchanged.
"""
import bpy,bmesh,json,hashlib,importlib.util,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base',ROOT/'scripts/import-sculpt-assets.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
OUT=ROOT/'public/sculpts';META=ROOT/'assets/sculpts';WORK=ROOT/'.tools/sculpts/sectioned';WORK.mkdir(parents=True,exist_ok=True)
SRC=OUT/'tripo-human-anatomy.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(SRC))
o=next(o for o in bpy.data.objects if o.type=='MESH');base.set_active(o);world=o.matrix_world.copy();o.parent=None;o.matrix_world=world;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
master=bmesh.new();master.from_mesh(o.data);bmesh.ops.remove_doubles(master,verts=list(master.verts),dist=1e-6);bmesh.ops.recalc_face_normals(master,faces=list(master.faces));master.verts.ensure_lookup_table();master.verts.index_update();master.normal_update()
original=[v.co.copy() for v in master.verts];normals=[v.normal.copy() for v in master.verts]
# Local smoothing rounds inter-muscle grooves. A modest outward offset represents
# soft tissue; this is a visualization envelope, not a measured skin/fat anatomy.
for _ in range(72):
 for strength in (.5,-.53):
  moves=[]
  for v in master.verts:
   neighbours=[e.other_vert(v).co for e in v.link_edges]
   mean=sum(neighbours,Vector())/len(neighbours) if neighbours else v.co
   moves.append(v.co.lerp(mean,strength))
  for v,co in zip(master.verts,moves):v.co=co
master.normal_update()
skin=[]
for v in master.verts:
 p=original[v.index];x=abs(p.x);z=p.z
 thickness=.003 if z>.65 or (x>.38 and z<.1) or z<-.78 else .009 if x<.22 and -.15<z<.55 else .005
 target=v.co+v.normal*thickness
 projection=(target-p).dot(normals[v.index])
 # Allow local smoothing to bridge grooves without reintroducing noisy source normals.
 skin.append(target.copy())
for v,co in zip(master.verts,original):v.co=co
layer=master.verts.layers.float_vector.new('SkinEnvelope')
for v,co in zip(master.verts,skin):v[layer]=co
print("ENVELOPE", len(skin), max((a-b).length for a,b in zip(skin,original)), flush=True)
master.normal_update()
for f in master.faces:f.smooth=True
material=o.data.materials[0].copy();bpy.data.objects.remove(o,do_unlink=True)
# Bounds/planes are authored for this specific reviewed source in metres, Z-up.
# Each plane retains the side in the direction of its normal.
PARTS=[
 ('body','Full body','body',[]),
 ('torso','Torso','torso',[( (0,0,-.045),(0,0,1)),((0,0,.64),(0,0,-1)),((.23,0,0),(-1,0,0)),((-.23,0,0),(1,0,0))]),
 ('left-arm','Left full arm','arm',[((.23,0,0),(1,0,0)),((0,0,-.15),(0,0,1))]),
 ('right-arm','Right full arm','arm',[((-.23,0,0),(-1,0,0)),((0,0,-.15),(0,0,1))]),
 ('left-forearm','Left forearm','arm',[((.23,0,0),(1,0,0)),((0,0,-.15),(0,0,1)),((0,0,.20),(0,0,-1))]),
 ('right-forearm','Right forearm','arm',[((-.23,0,0),(-1,0,0)),((0,0,-.15),(0,0,1)),((0,0,.20),(0,0,-1))]),
 ('left-leg','Left full leg','leg',[((.015,0,0),(1,0,0)),((0,0,-.10),(0,0,-1))]),
 ('right-leg','Right full leg','leg',[((-.015,0,0),(-1,0,0)),((0,0,-.10),(0,0,-1))]),
 ('neck','Neck','neck',[((0,0,.58),(0,0,1)),((0,0,.665),(0,0,-1)),((.115,0,0),(-1,0,0)),((-.115,0,0),(1,0,0))]),
 ('head','Head','head',[((0,0,.665),(0,0,1))]),
]
entries=[]
for short,label,section,planes in PARTS:
 bm=master.copy()
 for point,normal in planes:
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=Vector(point),plane_no=Vector(normal),clear_inner=True)
 # Keep the actual section, not disconnected fingertips caught by a leg cut.
 if planes:
  unseen=set(bm.verts);components=[]
  while unseen:
   seed=unseen.pop();component={seed};pending=[seed]
   while pending:
    v=pending.pop()
    for e in v.link_edges:
     n=e.other_vert(v)
     if n in unseen:unseen.remove(n);component.add(n);pending.append(n)
   components.append(component)
  keep=max(components,key=len)
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in keep],context='VERTS')
 # Keep skin and muscle cut rims on the same flat section plane.
 skinlayer=bm.verts.layers.float_vector.get('SkinEnvelope')
 for v in bm.verts:
  for point,normal in planes:
   p=Vector(point);n=Vector(normal).normalized()
   if abs((v.co-p).dot(n))<1e-5:
    t=Vector(v[skinlayer]);v[skinlayer]=t-n*(t-p).dot(n)
 # Cap section cuts without introducing a second render material.
 if planes:
  boundaries=[e for e in bm.edges if e.is_boundary]
  if boundaries:
   result=bmesh.ops.holes_fill(bm,edges=boundaries,sides=0)
   for face in result['faces']:face.smooth=False
 bmesh.ops.triangulate(bm,faces=list(bm.faces))
 bm.verts.ensure_lookup_table();bm.verts.index_update();bm.normal_update()
 assert len(bm.verts)>100,short
 skinlayer=bm.verts.layers.float_vector.get('SkinEnvelope')
 lo=Vector([min(v.co[i] for v in bm.verts) for i in range(3)]);hi=Vector([max(v.co[i] for v in bm.verts) for i in range(3)]);center=(lo+hi)/2
 targets=[Vector(v[skinlayer])-center for v in bm.verts]
 for v in bm.verts:v.co-=center
 mesh=bpy.data.meshes.new('Anatomy section');bm.to_mesh(mesh);bm.free()
 obj=bpy.data.objects.new('derived-anatomy-'+short,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
 obj.shape_key_add(name='Basis');shape=obj.shape_key_add(name='SkinEnvelope')
 for v,co in zip(shape.data,targets):v.co=co
 shape.value=0;base.set_active(obj)
 id=obj.name;path=OUT/(id+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_morph=True,export_morph_normal=True)
 base.render_view(obj,OUT/(id+'-muscle.png'))
 # The collection preview shows the skin envelope in neutral material.
 shape.value=1;obj.data.materials.clear();skinmat=bpy.data.materials.new('Skin preview');skinmat.use_nodes=True;skinmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.58,.43,.33,1);skinmat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.6;obj.data.materials.append(skinmat)
 base.render_view(obj,OUT/(id+'.png'))
 dims=hi-lo;height=round(dims.z*1000,2);width=1020 if section in ('body','torso') else 550 if section in ('head','leg') else 360
 entry=dict(id=id,name='Anatomy-derived '+label.lower(),section=section,heightMm=height,circumferenceMm=width,chartHeightMm=height,chartWidthMm=width,description=label+' with an aligned muscle surface and a smoothed soft-tissue envelope. Fixed A-pose.',file='/sculpts/'+id+'.glb',thumbnail='/sculpts/'+id+'.png',muscleThumbnail='/sculpts/'+id+'-muscle.png',author='Devauntae Norman',source='',license='User-provided Tripo generation',sourceFile='human anatomy model 3d.glb',sha256=json.loads((META/'tripo-human-anatomy.json').read_text())['sha256'],sourceParent='tripo-human-anatomy',groupId='derived-anatomy',groupName='Anatomy-derived body',poseName=label,variantLabel='Body section',skinEnvelope=True,rigged=False,dimensionsEstimated=True,triangleCount=len(obj.data.polygons),vertexCount=len(obj.data.vertices),bytes=path.stat().st_size,outputSha256=hashlib.sha256(path.read_bytes()).hexdigest(),dimensionsMm=[round(dims.x*1000,2),height,round(dims.y*1000,2)],units='meters',upAxis='Y',frontAxis='+Z',uvMethod='source with capped section cuts',skinMethod='72 Taubin smoothing passes plus 3–9 mm regional soft-tissue offset; illustrative, not anatomically validated')
 (META/(id+'.json')).write_text(json.dumps(entry,indent=2)+'\n');entries.append(entry)
 bpy.data.objects.remove(obj,do_unlink=True)
 print('SECTION',short,entry['vertexCount'],entry['triangleCount'],entry['dimensionsMm'],flush=True)
master.free()
catalog=json.loads((OUT/'catalog.json').read_text());ids={e['id'] for e in entries};catalog=[e for e in catalog if e['id'] not in ids]+entries;(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
