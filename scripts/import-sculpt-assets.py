"""Reproducible local import of the three user-supplied CC BY 4.0 sculpt GLBs.

Run with Blender, for example:
  Blender --background --factory-startup --disable-autoexec --python scripts/import-sculpt-assets.py
Optional arguments after --: --only sculpt-torso --no-bake
Source downloads are copied without modification into .tools/sculpts/originals.
This importer never changes the MakeHuman model or existing tattoo topology.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/sculpts'
META = ROOT / 'assets/sculpts'
WORK = ROOT / '.tools/sculpts'
DOWNLOADS = Path('/Users/bigbobby/Downloads')
SOURCES = ['06_torso.glb', 'anatomy_-_male_arm.glb', 'male_body_parts_sculpt.glb']
# Dimension estimates establish useful tattoo sizing, not anthropometric claims.
PARTS = [
 dict(id='torso-study', name='Torso study', section='torso', sourceFile=SOURCES[0], group=None, heightMm=650, circumferenceMm=1020, targetTriangles=180000, description='Sculpted male torso with neck and upper thighs.'),
 dict(id='anatomical-arm', name='Anatomical arm', section='arm', sourceFile=SOURCES[1], group=None, heightMm=730, circumferenceMm=310, targetTriangles=0, description='Textured anatomical arm study with shoulder and hand.'),
 dict(id='sculpt-torso', name='Sculpt torso', section='torso', sourceFile=SOURCES[2], group='1tronco', heightMm=650, circumferenceMm=1020, targetTriangles=220000, description='Muscular male torso with shoulder caps, neck and upper thighs.'),
 dict(id='sculpt-arm', name='Sculpt arm', section='arm', sourceFile=SOURCES[2], group='2bracos', heightMm=600, circumferenceMm=310, targetTriangles=150000, description='Shoulder-to-wrist muscular arm; hand is available separately.'),
 dict(id='sculpt-hand', name='Sculpt hand', section='hand', sourceFile=SOURCES[2], group='3maos', heightMm=205, circumferenceMm=205, targetTriangles=120000, description='Separate detailed hand and wrist.'),
 dict(id='sculpt-leg', name='Sculpt leg', section='leg', sourceFile=SOURCES[2], group='4pernas', heightMm=915, circumferenceMm=540, targetTriangles=180000, description='Thigh-to-ankle muscular leg; foot is available separately.'),
 dict(id='sculpt-foot', name='Sculpt foot', section='foot', sourceFile=SOURCES[2], group='5pes', lengthMm=260, heightMm=118, circumferenceMm=250, targetTriangles=140000, description='Separate foot with toes and ankle.'),
]

def glb_metadata(path):
    with path.open('rb') as f:
        header = f.read(20)
        _, _, _, size, _ = struct.unpack('<5I', header)
        data = json.loads(f.read(size))
    return data.get('asset', {}).get('extras', {})

def bounds(obj):
    coords = [v.co for v in obj.data.vertices]
    lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
    return lo, hi

def set_active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def source_for(part):
    path = WORK / 'originals' / part['sourceFile']
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        shutil.copy2(DOWNLOADS / part['sourceFile'], path)
    return path

def load_part(part):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = source_for(part)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and (part['group'] is None or o.parent and o.parent.name == part['group'])]
    if not meshes:
        raise RuntimeError('No mesh for '+part['id'])
    for obj in list(bpy.data.objects):
        if obj not in meshes and obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        set_active(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = meshes[0]
    obj.name = part['id']
    for other in list(bpy.data.objects):
        if other != obj:
            bpy.data.objects.remove(other, do_unlink=True)
    original_vertices = len(obj.data.vertices)
    original_triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
    lo, hi = bounds(obj)
    scale = ((part['lengthMm'] / 1000) / max(hi-lo)) if 'lengthMm' in part else (part['heightMm']/1000)/(hi.z-lo.z)
    center = (lo+hi)/2
    for v in obj.data.vertices:
        v.co = (v.co-center)*scale
    # Collapse exporter-created duplicate vertices and inter-chunk seams without
    # moving the sculpt. 0.5 micrometres is far below visible geometric detail.
    if part['id'] != 'anatomical-arm':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0000005)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    rotation = {'torso-study': math.pi, 'anatomical-arm': -math.pi/2, 'sculpt-arm': -math.pi/2}.get(part['id'], 0)
    if rotation:
        transform = Matrix.Rotation(rotation, 3, 'Z')
        for vertex in obj.data.vertices: vertex.co = transform @ vertex.co
    obj.data.update()
    return obj, original_vertices, original_triangles

def sculpt_uv(obj):
    """Unwrap a dedicated, non-overlapping bake chart after optimization.

    Some source limb meshes have UV layers containing only zero coordinates;
    presence of a layer is therefore insufficient. Runtime tattoo charts are
    independent of these detail-map UVs.
    """
    set_active(obj)
    for uv in list(obj.data.uv_layers):obj.data.uv_layers.remove(uv)
    obj.data.uv_layers.new(name='SculptDetailUV')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.005, area_weight=.25, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    return 'non-overlapping-detail-atlas'

def neutral_material(obj):
    mat=bpy.data.materials.new('Sculpt clay')
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(0.58,0.43,0.33,1)
    bsdf.inputs['Roughness'].default_value=.58
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for p in obj.data.polygons:p.material_index=0
    return mat

def bake_detail(low, high, part):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=1
    scene.render.bake.use_selected_to_active=True
    scene.render.bake.cage_extrusion=.0005
    scene.render.bake.max_ray_distance=.0015
    scene.render.bake.margin=12
    # 4K for the broad torso, 2K on smaller parts. Geometry retains silhouette.
    size=4096 if part['section']=='torso' else 2048
    image=bpy.data.images.new(part['id']+' sculpt normals',width=size,height=size,alpha=False)
    image.generated_color=(.5,.5,1,1)
    image.colorspace_settings.name='Non-Color'
    mat=low.data.materials[0]
    nodes=mat.node_tree.nodes
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=image
    nodes.active=texture
    bpy.ops.object.select_all(action='DESELECT')
    high.hide_render=False
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active=low
    bpy.ops.object.bake(type='NORMAL')
    image.filepath_raw=str(OUT/(part['id']+'-normal.png'))
    image.file_format='PNG'
    image.save()
    image.pack()
    normal=nodes.new('ShaderNodeNormalMap')
    mat.node_tree.links.new(texture.outputs['Color'],normal.inputs['Color'])
    mat.node_tree.links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
    return size

def add_area(name, location, energy, size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()

def render_view(obj, path, angle=0):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=16
    scene.cycles.use_denoising=True
    scene.render.resolution_x=512
    scene.render.resolution_y=640
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.world=bpy.data.worlds.new('Studio world') if not scene.world else scene.world
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.055,.055,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    lo,hi=bounds(obj)
    length=max(hi-lo)
    camera_data=bpy.data.cameras.new('Preview camera')
    camera=bpy.data.objects.new('Preview camera',camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.type='ORTHO'
    camera_data.ortho_scale=max((hi.z-lo.z)*1.15,(hi.x-lo.x)*1.45, length*.8)
    if obj.name == 'sculpt-foot': camera_data.ortho_scale = length*1.5
    if obj.name == 'sculpt-foot' and angle == 0: angle = -.55
    elevation = .85 if obj.name == 'sculpt-foot' else .12
    camera.location=(math.sin(angle)*length*3,-math.cos(angle)*length*3,length*elevation)
    camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    power=length*length
    add_area('Large key',(-length*1.5,-length*2,length*2),200*power,length*1.5)
    add_area('Soft fill',(length*2,-length*.5,length*.3),80*power,length*2)
    add_area('Rim',(length*.6,length*2,length*1.5),180*power,length)
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    for item in list(bpy.data.objects):
        if item.type in ('LIGHT','CAMERA'):bpy.data.objects.remove(item,do_unlink=True)

def process(part,no_bake=False):
    obj,original_vertices,original_triangles=load_part(part)
    source=glb_metadata(source_for(part))
    welded_vertices=len(obj.data.vertices)
    high=None
    normal_size=None
    target=part['targetTriangles']
    triangle_count=sum(len(p.vertices)-2 for p in obj.data.polygons)
    uv_method='source' if part['id']=='anatomical-arm' else 'non-overlapping-detail-atlas'
    if part['id']!='anatomical-arm':neutral_material(obj)
    if target and triangle_count>target:
        high=obj.copy()
        high.data=obj.data.copy()
        high.name=part['id']+'-source-detail'
        bpy.context.collection.objects.link(high)
        set_active(obj)
        modifier=obj.modifiers.new('Preserve sculpt silhouette','DECIMATE')
        modifier.ratio=target/triangle_count
        modifier.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        sculpt_uv(obj)
        if not no_bake:normal_size=bake_detail(obj,high,part)
        bpy.data.objects.remove(high,do_unlink=True)
    set_active(obj)
    tri=obj.modifiers.new('Export triangles','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=tri.name)
    obj.data.update()
    lo,hi=bounds(obj)
    dimensions=hi-lo
    obj['source']=source.get('source','')
    obj['author']=source.get('author','')
    obj['license']='CC-BY-4.0'
    obj['dimensionNote']='Approximate adult dimensions for placement preview; not a body measurement.'
    obj['sourcePart']=part.get('group') or source.get('title',part['id'])
    export=OUT/(part['id']+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
    render_view(obj,OUT/(part['id']+'.png'))
    if part['section'] in ('torso','leg','arm'):
        render_view(obj,WORK/(part['id']+'-back.png'),math.pi)
        render_view(obj,WORK/(part['id']+'-side.png'),math.pi/2)
    entry={k:part[k] for k in ('id','name','section','description','heightMm','circumferenceMm')}
    entry.update(file='/sculpts/'+part['id']+'.glb',thumbnail='/sculpts/'+part['id']+'.png',source=source.get('source',''),author=source.get('author',''),license='CC-BY-4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/',sourceTitle=source.get('title',''),sourceFile=part['sourceFile'],sourcePart=part['group'],sha256=hashlib.sha256(source_for(part).read_bytes()).hexdigest(),triangleCount=len(obj.data.polygons),vertexCount=len(obj.data.vertices),originalTriangleCount=original_triangles,originalVertexCount=original_vertices,weldedVertexCount=welded_vertices,normalMapResolution=normal_size,uvMethod=uv_method,dimensionsMm=[round(dimensions.x*1000,2),round(dimensions.z*1000,2),round(dimensions.y*1000,2)],chartWidthMm=part['circumferenceMm'],chartHeightMm=part['heightMm'],units='meters',upAxis='Y',frontAxis='+Z',rigged=False,dimensionsEstimated=True,bytes=export.stat().st_size,outputSha256=hashlib.sha256(export.read_bytes()).hexdigest())
    (META/(part['id']+'.json')).write_text(json.dumps(entry,indent=2)+'\n')
    print('FINISHED',json.dumps(entry),flush=True)
    return entry

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',nargs='+')
    parser.add_argument('--no-bake',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for directory in (OUT,META,WORK):directory.mkdir(parents=True,exist_ok=True)
    for part in PARTS:
        if not args.only or part['id'] in args.only:process(part,args.no_bake)
    catalog=[json.loads((META/(part['id']+'.json')).read_text()) for part in PARTS if (META/(part['id']+'.json')).exists()]
    # Preserve independently imported collections when rebuilding the original seven parts.
    existing=json.loads((OUT/'catalog.json').read_text()) if (OUT/'catalog.json').exists() else []
    ids={e['id'] for e in catalog}
    catalog += [e for e in existing if e['id'] not in ids]
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
    (META/'README.md').write_text('''# Imported sculpt parts\n\nSeven static sculpt surfaces derived from three user-supplied GLBs. Originals are preserved without modification in `.tools/sculpts/originals/`. Each entry in `public/sculpts/catalog.json` records its source URL, author, CC BY 4.0 license, input SHA-256, selected source group, geometric counts, and estimated physical dimensions.\n\nRegenerate with Blender using `scripts/import-sculpt-assets.py`. Multipart exports are joined by authored anatomical group, welded at 0.5 micrometres, decimated for interaction, and normal-baked from the original surface (4K torso, 2K limbs). The anatomical arm retains its authored textures and geometry. These are static surfaces; they do not inherit the native body's pose or build controls. No source arm/hand or leg/foot parts are falsely combined. Dimensions are estimates, not scanned anthropometry.\n\nAdaptations: separation, centering, scale normalization, export cleanup, triangle reduction, non-overlapping UV atlas creation on sculpt meshes, normal baking, neutral sculpt material, front orientation corrections, and preview rendering. The files remain under CC BY 4.0 with the respective source attribution.\n''')
